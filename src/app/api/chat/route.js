import { GoogleGenAI } from '@google/genai';
import { extractText, getDocumentProxy } from 'unpdf';
import { auth } from '@/auth';
import { getUserState, resolveEffectivePlan, getUsageWindow, recordUsage, saveUserState } from '../_lib/user-plan';
import { getUserProfile, mergeUserProfile } from '../_lib/user-profile';
import { touchUser } from '../_lib/admin';
import { isUserBlocked, containsProfanity, recordViolation } from '../_lib/moderation';
import {
  IMAGE_COMMAND_RE,
  PRESENTATION_COMMAND_RE,
  SEARCH_COMMAND_RE,
  CODE_COMMAND_RE,
  DEFAULT_MODEL,
  modelForPlan,
  thinkingLevelForPlan,
  buildSystemInstruction,
  extractHiddenTags,
  generateImage,
  generatePresentation,
  performWebSearch,
  executeCode,
  appendDocumentText,
  withRetry,
  friendlyAiError,
  autoToolsForPlan,
  STEP_STATUS_TEXT,
} from '../_lib/ai-generation';
import { generateImageViaLocal } from '../_lib/local-image';
import { extractDocumentText } from '../_lib/document-extract';
import { resolveAttachments, defaultPromptFor } from '../_lib/attachments';
import { recordEvent } from '../_lib/stats';
import { getSettings } from '../_lib/settings';
 
// Uzun javoblar va katta video tahlili (Gemini Files API) Vercel'ning standart
// vaqt chegarasida kesilib qolmasligi uchun. Fluid compute'da Hobby rejasi ham
// 300 soniyaga ruxsat beradi.
export const maxDuration = 300;
 
// Gemini API kaliti FAQAT .env.local fayldan o'qiladi — kodga yozilmaydi,
// shunda GitHub'ga push qilsang ham kaliting ochilib qolmaydi (.env* .gitignore'da).
// Model tanlash va "o'ylash darajasi" endi _lib/ai-generation.js'da — Telegram
// bot bilan umumiy.
const API_KEY = process.env.GEMINI_API_KEY;
 
// ============================================================
// SSE (server-sent events) oqimi uchun umumiy yordamchi.
//
// Ilgari har bir buyruq (rasm, qidiruv, kod, taqdimot, oddiy chat) o'zining
// ReadableStream'ini qo'lda yasar edi. Bundan tashqari, foydalanuvchi
// "To'xtatish"ni bossa (yoki sahifani yopsa) controller.enqueue()
// "Invalid state" xatosi berar, bu xato catch'da yana send() chaqirib,
// ikkinchi marta portlardi. Endi: yopilgan oqimga yozish jimgina
// e'tiborsiz qoldiriladi va oqim bekor qilinganini `isClosed()` orqali
// bilib, Gemini'dan kelayotgan oqimni ham to'xtatamiz (token tejaladi).
// ============================================================
function sseResponse(run) {
  const encoder = new TextEncoder();
  let closed = false;

  const readable = new ReadableStream({
    async start(controller) {
      function send(obj) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          closed = true;
        }
      }
      try {
        await run({ send, isClosed: () => closed });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
 
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}
 
async function notifyAdminOfAutoBlock(email) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🚫 Avtomatik bloklandi: ${email}\n\nSabab: nomaqbul til (3 marta ogohlantirishdan keyin). Admin panelda tekshirib, xato bo'lsa blokdan chiqarishingiz mumkin.`,
    }),
  }).catch(() => {});
}
 
export async function POST(req) {
  try {
    return await handleChatRequest(req);
  } catch (error) {
    // OXIRGI xavfsizlik chizig'i — kutilmagan xato (masalan Redis vaqtincha
    // ishlamay qolsa) butun chatni "500" bilan to'xtatib qo'ymasligi uchun.
    // To'liq xato Vercel jurnaliga (Logs) yoziladi — shu orqali sababini topish oson.
    console.error('Chat API kutilmagan xato:', error);
    return Response.json(
      { response: "Kechirasiz, vaqtincha texnik nosozlik yuz berdi. Birozdan keyin qayta urinib ko'ring." },
      { status: 500 }
    );
  }
}
 
async function handleChatRequest(req) {
  const body = await req.json();
  const { text, image, pdf, document, previousInteractionId, profile: clientProfile, deepThink } = body;
  // Yangi usul: bir nechta biriktirma (inline base64 yoki Vercel Blob URL).
  const files = Array.isArray(body.files) ? body.files.slice(0, 10) : [];
 
  if (!text && !image && !pdf && !document && !files.length) {
    return Response.json({ response: 'Matn, rasm yoki fayl kiritilmadi!' }, { status: 400 });
  }
  if (text && text.length > 8000) {
    return Response.json({ response: 'Xabar juda uzun (8000 belgidan oshmasin).' }, { status: 400 });
  }
 
  if (!API_KEY) {
    return Response.json(
      { response: "Server sozlanmagan: .env.local faylida GEMINI_API_KEY yo'q." },
      { status: 500 }
    );
  }
 
  // Foydalanuvchini SERVER TOMONDA aniqlaymiz (session orqali) — mijoz (brauzer)
  // tomonidan yuborilgan email'ga ishonib bo'lmaydi, aks holda limitni chetlab o'tish oson bo'lardi.
  // Kirish MAJBURIY: aks holda hisobsiz odam ham cheksiz Gemini API sarflay olardi.
  const session = await auth();
  const email = session?.user?.email || null;
  if (!email) {
    return Response.json({ response: 'Avval Google orqali tizimga kiring.' }, { status: 401 });
  }
 
  // Admin paneldan boshqariladigan sozlamalar (texnik ishlar, vositalar va h.k.).
  const settings = await getSettings().catch(() => null);
  if (settings?.maintenance?.enabled) {
    return Response.json(
      { response: settings.maintenance.message || 'Texnik ishlar olib borilmoqda — birozdan keyin qayting.' },
      { status: 503 }
    );
  }

  // Admin tomonidan bloklangan foydalanuvchi — hech qanday xabar qabul qilinmaydi.
  if (await isUserBlocked(email)) {
    return Response.json(
      { response: "Qoidalarni buzganingiz uchun hisobingiz cheklangan. Savol bo'lsa, admin bilan bog'laning." },
      { status: 403 }
    );
  }
 
  // Nomaqbul til aniqlansa — xabar AI'ga umuman yuborilmaydi, foydalanuvchiga
  // ogohlantirish qaytariladi. Bir necha marta takrorlansa (VIOLATION_LIMIT),
  // avtomatik bloklanadi va admin'ga Telegram orqali xabar boradi.
  if (containsProfanity(text)) {
    const { count, blocked } = await recordViolation(email);
    if (blocked) {
      notifyAdminOfAutoBlock(email).catch(() => {});
      return Response.json(
        { response: "Nomaqbul til ishlatganingiz tufayli hisobingiz bloklandi. Savol bo'lsa, admin bilan bog'laning." },
        { status: 403 }
      );
    }
    return Response.json(
      {
        response: `Iltimos, odobli til bilan gaplashaylik, jigar 🙏 (Ogohlantirish ${count}/${3} — davom etsa, hisobingiz bloklanadi.)`,
      },
      { status: 400 }
    );
  }
 
  // Admin panelidagi "online foydalanuvchilar" ro'yxati uchun faollikni belgilaymiz.
  touchUser(email, { name: session.user.name, image: session.user.image }).catch(() => {});
 
  // Profilni SERVERDAGI (Redis) nusxadan olamiz, mijoz yuborgan qiymatga ishonmaymiz —
  // aks holda birov so'rovni o'zgartirib, AI'ning tizim ko'rsatmasiga xohlagan matnini
  // ("prompt injection") kiritib yuborishi mumkin edi. Redis bo'lmasa/bo'sh bo'lsa,
  // mijoz yuborgan profilga (faqat ko'rsatish maqsadida, zararsiz fallback sifatida) tushamiz.
  const profile = (await getUserProfile(email).catch(() => null)) || clientProfile || {};
 
  let effectivePlan = { plan: null, mode: 'active' };
  let userState = null;
  // "trial" rejimida cooldownHours bor (aylanma oyna), "active"da yo'q (kalendar kuni).
  let usageCooldownHours;
  let usageLimit;
 
  if (email) {
    userState = await getUserState(email);
    effectivePlan = resolveEffectivePlan(userState);
    const { plan, mode } = effectivePlan;
 
    if (mode === 'downgraded') {
      const unlockLabel = effectivePlan.unlockAt
        ? ` Soat ${formatTime(effectivePlan.unlockAt)}da yana bepul sinab ko'rishingiz mumkin, yoki hoziroq sotib oling.`
        : '';
      return Response.json(
        {
          response: `${effectivePlan.wantedPlan?.name || 'Tarifingiz'} vaqti tugadi.${unlockLabel}`,
          requiresUpgrade: true,
          suggestedPlan: effectivePlan.wantedPlan?.id || 'pro',
          unlockAt: effectivePlan.unlockAt || null,
        },
        { status: 402 }
      );
    }
 
    usageCooldownHours = mode === 'trial' ? plan.trial?.cooldownHours : undefined;
    usageLimit = mode === 'trial' ? plan.trial.limit : plan.dailyLimit;
    const win = getUsageWindow(userState, usageCooldownHours);
 
    if (win.count >= usageLimit) {
      const unlockLabel = win.unlockAt ? ` Soat ${formatTime(win.unlockAt)}da yana ishlata olasiz.` : ' Ertaga davom eting yoki tarifni oshiring.';
      return Response.json(
        {
          response: `"${plan.name}"${mode === 'trial' ? ' bepul sinov' : ''} limitiga (${usageLimit} xabar) yetdingiz.${unlockLabel}`,
          requiresUpgrade: plan.id !== 'promax',
          suggestedPlan: plan.id === 'lite' ? 'pro' : plan.id === 'pro' ? 'max' : 'promax',
          unlockAt: win.unlockAt || null,
        },
        { status: 402 }
      );
    }
  }
 
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const startedAt = Date.now();
 
  function applyUsage() {
    let planPayload;
    if (email && userState && effectivePlan.plan) {
      recordUsage(userState, usageCooldownHours);
      saveUserState(email, userState).catch((err) => console.error('Limit saqlashda xato:', err));
      const win = getUsageWindow(userState, usageCooldownHours);
      planPayload = {
        id: effectivePlan.plan.id,
        name: effectivePlan.plan.name,
        mode: effectivePlan.mode,
        limit: usageLimit,
        used: win.count,
        remaining: Math.max(0, usageLimit - win.count),
        resetAt: win.unlockAt || null,
      };
    }
    return planPayload;
  }
 
  // "/rasm <tavsif>" — AI orqali rasm chizib berish buyrug'i. Oddiy matn suhbatidan
  // butunlay boshqacha (streaming yo'q) bo'lgani uchun alohida yo'l sifatida ajratilgan.
  const imageCommandMatch = text?.trim().match(IMAGE_COMMAND_RE);
  if (imageCommandMatch) {
    if (settings?.features?.imageGen === false) {
      return Response.json({ response: 'Rasm chizish vaqtincha o\'chirilgan — birozdan keyin urinib ko\'ring.' }, { status: 503 });
    }
    const imagePrompt = imageCommandMatch[1].trim();
    return sseResponse(async ({ send }) => {
      try {
        send({ type: 'chunk', text: 'Rasm chizilmoqda, biroz kuting... 🎨' });

        // Max va Pro Max obunachilari uchun — ular allaqachon pullik tarifda,
        // shuning uchun ularga sifatliroq (lekin bizga xarajat qiladigan)
        // Gemini rasm modeli beriladi. Qolgan hamma (Lite/Pro) uchun —
        // bepul Pollinations.ai ishlatiladi. Tarjima + provayderlar tartibi
        // endi generateImage() ichida (Telegram bilan umumiy).
        const result = await generateImage(ai, {
          prompt: imagePrompt,
          model: effectivePlan.plan ? modelForPlan(effectivePlan.plan) : DEFAULT_MODEL,
          premium: ['max', 'promax'].includes(effectivePlan.plan?.id),
          localProvider: generateImageViaLocal,
          onProgress: (msg) => send({ type: 'chunk', text: `${msg}\n\n` }),
        });

        const dataUrl = `data:${result.mimeType};base64,${result.base64}`;
        send({
          type: 'done',
          text: 'Mana, tayyor! 🖼️',
          image: { dataUrl, mimeType: result.mimeType },
          plan: applyUsage(),
        });
        recordEvent({ channel: 'web', kind: 'rasm', email, ok: true, ms: Date.now() - startedAt });
      } catch (error) {
        // Haqiqiy sabab serverda qoladi, foydalanuvchi oddiy xabar oladi.
        console.error('Rasm yaratishda xato:', error);
        recordEvent({ channel: 'web', kind: 'rasm', email, ok: false, ms: Date.now() - startedAt, error: error?.message });
        send({ type: 'error', message: "Rasm chizib bo'lmadi — birozdan keyin qayta urinib ko'ring." });
      }
    });
  }
 
  // "/qidir <savol>" — internet orqali joriy ma'lumot qidirish.
  const searchMatch = text?.trim().match(SEARCH_COMMAND_RE);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    return sseResponse(async ({ send }) => {
      try {
        send({ type: 'chunk', text: 'Internetdan qidirilmoqda... 🔍' });
        const MODEL = effectivePlan.plan ? modelForPlan(effectivePlan.plan) : DEFAULT_MODEL;
        const systemInstruction = buildSystemInstruction(profile, profile?.til);
        const answer = await withRetry((m) => performWebSearch(ai, m, query, systemInstruction), { model: MODEL });
        send({ type: 'done', text: answer, plan: applyUsage() });
        recordEvent({ channel: 'web', kind: 'qidir', email, ok: true, ms: Date.now() - startedAt, model: MODEL });
      } catch (error) {
        console.error('Qidiruvda xato:', error);
        recordEvent({ channel: 'web', kind: 'qidir', email, ok: false, ms: Date.now() - startedAt, model: MODEL, error: error?.message });
        send({ type: 'error', message: friendlyAiError(error) });
      }
    });
  }
 
  // "/kod <masala>" — Python kodini HAQIQATAN ishga tushirib, natijasini
  // (kerak bo'lsa grafik bilan) qaytarish.
  const codeMatch = text?.trim().match(CODE_COMMAND_RE);
  if (codeMatch) {
    const task = codeMatch[1].trim();
    return sseResponse(async ({ send }) => {
      try {
        send({ type: 'chunk', text: 'Kod yozilib, ishga tushirilmoqda... 💻' });
        const MODEL = effectivePlan.plan ? modelForPlan(effectivePlan.plan) : DEFAULT_MODEL;
        const systemInstruction = buildSystemInstruction(profile, profile?.til);
        const { text: resultText, code, imageBase64 } = await withRetry((m) => executeCode(ai, m, task, systemInstruction), { model: MODEL });

        let finalText = resultText || '';
        if (code) finalText += `\n\n\`\`\`python\n${code}\n\`\`\``;

        const payload = { type: 'done', text: finalText || 'Bajarildi.', plan: applyUsage() };
        if (imageBase64) {
          payload.image = { dataUrl: `data:image/png;base64,${imageBase64}`, mimeType: 'image/png' };
        }
        send(payload);
        recordEvent({ channel: 'web', kind: 'kod', email, ok: true, ms: Date.now() - startedAt, model: MODEL });
      } catch (error) {
        console.error('Kod ishga tushirishda xato:', error);
        recordEvent({ channel: 'web', kind: 'kod', email, ok: false, ms: Date.now() - startedAt, model: MODEL, error: error?.message });
        send({ type: 'error', message: friendlyAiError(error) });
      }
    });
  }
 
  // "/prezentatsiya <mavzu>" yoki "/taqdimot <mavzu>" — haqiqiy .pptx fayl yaratish.
  const presentationMatch = text?.trim().match(PRESENTATION_COMMAND_RE);
  if (presentationMatch) {
    const topic = presentationMatch[2].trim();
    return sseResponse(async ({ send }) => {
      try {
        send({ type: 'chunk', text: 'Prezentatsiya tayyorlanmoqda, biroz kuting... 📊' });
        const MODEL = effectivePlan.plan ? modelForPlan(effectivePlan.plan) : DEFAULT_MODEL;
        const { base64, filename, title, slideCount } = await withRetry((m) => generatePresentation(ai, m, topic), { model: MODEL });
        send({
          type: 'done',
          text: `Mana, tayyor! 📊 "${title}" — ${slideCount} slayd.`,
          file: {
            base64,
            filename,
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          },
          plan: applyUsage(),
        });
        recordEvent({ channel: 'web', kind: 'prezentatsiya', email, ok: true, ms: Date.now() - startedAt, model: MODEL });
      } catch (error) {
        console.error('Prezentatsiya yaratishda xato:', error);
        recordEvent({ channel: 'web', kind: 'prezentatsiya', email, ok: false, ms: Date.now() - startedAt, model: MODEL, error: error?.message });
        send({ type: 'error', message: friendlyAiError(error) });
      }
    });
  }
 
  // PDF biriktirilgan bo'lsa (eski usul) — matnini shu yerda (serverda) chiqarib olamiz,
  // chunki brauzerda PDF o'qish murakkab va katta kutubxona talab qiladi.
  let pdfSection = '';
  if (pdf?.data) {
    try {
      const buffer = Buffer.from(pdf.data, 'base64');
      const pdfDoc = await getDocumentProxy(new Uint8Array(buffer));
      const { text: extracted } = await extractText(pdfDoc, { mergePages: true });
      pdfSection = `\n\n[PDF fayl: ${pdf.name || 'fayl.pdf'}]\n${(extracted || '').trim().slice(0, 12000)}`;
    } catch (err) {
      console.error("PDF o'qishda xato:", err);
      pdfSection = `\n\n(Foydalanuvchi "${pdf.name || 'fayl.pdf'}" nomli PDF fayl yubordi, lekin uni o'qib bo'lmadi — fayl buzilgan yoki parol bilan himoyalangan bo'lishi mumkin.)`;
    }
  }
 
  let textWithPdf = `${text || (pdf?.data ? 'Bu PDF faylda nima yozilganini tushuntirib ber.' : '')}${pdfSection}`;
 
  // Word (.docx) va Excel (.xlsx/.xls) fayllar (eski usul) — "Sohaviy bilim" uchun
  // yozilgan extractDocumentText() shu yerda ham ishlatiladi.
  if (document?.data) {
    let extracted = '';
    try {
      extracted = await extractDocumentText(document.data, document.name);
    } catch (err) {
      console.error("Hujjatni o'qishda xato:", err);
    }
    textWithPdf = appendDocumentText(textWithPdf, document.name, extracted);
  }
 
  // Yangi usul: bir nechta biriktirma — rasm, video, audio, PDF, Word, Excel,
  // matn. Katta fayllar Blob'dan o'qilib, Gemini Files API orqali beriladi.
  // Jarayon holati foydalanuvchiga "status" hodisalari bilan ko'rsatiladi.
  const legacyImagePart = image?.data ? [{ type: 'image', data: image.data, mime_type: image.mimeType }] : [];
  if (!textWithPdf && (files.length || image?.data)) {
    textWithPdf = files.length ? defaultPromptFor(files) : 'Bu rasmda nima borligini aytib ber.';
  }
 
  const systemInstruction = buildSystemInstruction(profile, profile?.til);
  const MODEL = effectivePlan.plan ? modelForPlan(effectivePlan.plan) : DEFAULT_MODEL;
  const thinkingLevel = thinkingLevelForPlan(effectivePlan.plan?.id, Boolean(deepThink));
 
  // Avtomatik vositalar (internet qidiruv, havola o'qish) va fikrlash
  // qisqacha mazmuni — zamonaviy AI chatlardagi kabi.
  const tools = autoToolsForPlan(effectivePlan.plan?.id, settings);
  const wantThinkingSummary = settings?.features?.thinkingSummaries !== false && (deepThink || thinkingLevel !== 'low');
 
  async function openStream(prevId, input, model = MODEL, withTools = true) {
    return ai.interactions.create({
      model,
      input,
      system_instruction: systemInstruction,
      previous_interaction_id: prevId || undefined,
      stream: true,
      tools: withTools ? tools : undefined,
      generation_config: {
        max_output_tokens: 8192,
        thinking_level: thinkingLevel,
        thinking_summaries: wantThinkingSummary ? 'auto' : undefined,
      },
    });
  }
 
  // Oxirgi ~100 belgini har doim "xavfsiz zaxira"da ushlab turamiz — chunki yashirin
  // [[ESLA: ...]] belgisi javobning aynan oxirida chiqadi va foydalanuvchiga hech qachon
  // ko'rsatilmasligi kerak. Stream tugagach, to'liq tozalangan matn bilan almashtiramiz.
  // Endi [[TAKLIF: ...]] qatorlari ham bor — zaxira kattaroq.
  const SAFE_TAIL = 260;
 
  return sseResponse(async ({ send, isClosed }) => {
    let fullText = '';
    let emittedUpTo = 0;
    let interactionId = null;
 
    try {
      // Biriktirmalarni tayyorlash (katta fayl bo'lsa vaqt oladi — holat yuboriladi).
      let mediaParts = [...legacyImagePart];
      let finalText = textWithPdf;
      if (files.length) {
        const resolved = await resolveAttachments(ai, files, {
          onStatus: (msg) => send({ type: 'status', text: msg }),
        });
        mediaParts = [...mediaParts, ...resolved.parts];
        finalText = `${finalText}${resolved.textSection}`;
      }
      const input = mediaParts.length
        ? [{ type: 'text', text: finalText || 'Bu faylda nima borligini aytib ber.' }, ...mediaParts]
        : finalText;
 
      send({ type: 'status', text: deepThink ? "Chuqur o'ylayapman..." : "O'ylayapman..." });
 
      // Oqimni ochish: 1) oldingi suhbat ipi bilan, 2) ip eskirgan bo'lsa usiz,
      // 3) vositalar xato bersa ularsiz, 4) model topilmasa standart model.
      const stream = await withRetry(
        async (model) => {
          try {
            return await openStream(previousInteractionId, input, model, true);
          } catch (err) {
            const msg = String(err?.message || err);
            if (previousInteractionId && /interaction|previous|not found|expired|404/i.test(msg)) {
              return openStream(null, input, model, true);
            }
            if (tools && /tool|google_search|url_context|not supported|400|INVALID_ARGUMENT/i.test(msg)) {
              console.warn('[AI] vositalar bilan ochilmadi, ularsiz qayta:', msg);
              return openStream(previousInteractionId, input, model, false);
            }
            throw err;
          }
        },
        { model: MODEL, onRetry: () => send({ type: 'status', text: 'Server band, qayta urinyapman...' }) }
      );
 
      const sources = [];
      const seenUrls = new Set();
      let thinkingText = '';
 
      for await (const event of stream) {
        // Foydalanuvchi "To'xtatish"ni bosgan bo'lsa — Gemini oqimini ham
        // davom ettirmaymiz (behuda token sarflanmasin).
        if (isClosed()) break;
        // MUHIM: Interactions API'da chat ID'si event.interaction.id ichida keladi,
        // event.id emas — shu xato tufayli suhbat tarixi hech qachon davom etmagan.
        if (event?.interaction?.id) interactionId = event.interaction.id;
 
        if (event?.event_type === 'step.start') {
          const t = event.step?.type;
          if (STEP_STATUS_TEXT[t]) send({ type: 'status', text: STEP_STATUS_TEXT[t] });
          continue;
        }
        if (event?.event_type !== 'step.delta') continue;
        const d = event.delta;
        if (!d) continue;
 
        if (d.type === 'text') {
          fullText += d.text;
          const safeLen = Math.max(0, fullText.length - SAFE_TAIL);
          if (safeLen > emittedUpTo) {
            send({ type: 'chunk', text: fullText.slice(emittedUpTo, safeLen) });
            emittedUpTo = safeLen;
          }
        } else if (d.type === 'thought_summary') {
          const t = d.content?.text || '';
          if (t) {
            thinkingText += t;
            send({ type: 'thinking', text: t });
          }
        } else if (d.type === 'text_annotation_delta') {
          for (const a of d.annotations || []) {
            if (a?.type === 'url_citation' && a.url && !seenUrls.has(a.url)) {
              seenUrls.add(a.url);
              sources.push({ url: a.url, title: a.title || '' });
            }
          }
        }
      }
 
      if (isClosed()) return;
 
      const { facts, followups, cleanText } = extractHiddenTags(fullText);
      if (!cleanText && !thinkingText) throw new Error('Model bo\'sh javob qaytardi');
 
      // Yangi bilib olingan faktlar (ism va h.k.) bor bo'lsa — Redis'ga ham yozib
      // qo'yamiz, shunda foydalanuvchi boshqa qurilmadan kirsa ham eslab qoladi.
      // Xato bo'lsa ham (masalan Redis ulanmagan) javobni to'sib qo'ymaymiz.
      if (email && Object.keys(facts).length) {
        mergeUserProfile(email, facts).catch((err) => console.error('Profil saqlashda xato:', err));
      }
 
      send({
        type: 'done',
        text: cleanText || 'Javob kelmadi.',
        interactionId,
        facts: Object.keys(facts).length ? facts : undefined,
        followups: followups.length ? followups : undefined,
        sources: sources.length ? sources : undefined,
        plan: applyUsage(),
      });
      recordEvent({ channel: 'web', kind: 'chat', email, ok: true, ms: Date.now() - startedAt, model: MODEL });
    } catch (error) {
      console.error('API Error:', error);
      recordEvent({ channel: 'web', kind: 'chat', email, ok: false, ms: Date.now() - startedAt, model: MODEL, error: error?.message });
      // Qisman javob kelgan bo'lsa — uni yo'qotmaymiz, xato o'rniga saqlab qolamiz.
      if (fullText.trim()) {
        const { cleanText } = extractHiddenTags(fullText);
        send({ type: 'done', text: `${cleanText}\n\n_(javob to'liq kelmadi — qayta yozdirib ko'ring)_`, interactionId, plan: applyUsage() });
      } else {
        send({ type: 'error', message: friendlyAiError(error) });
      }
    }
  });
}
