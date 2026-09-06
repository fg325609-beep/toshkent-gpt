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
  buildSystemInstruction,
  extractFacts,
  generateImageViaPollinations,
  generateImageViaGemini,
  generatePresentation,
} from '../_lib/ai-generation';
 
// Uzun javoblar Vercel'ning standart vaqt chegarasida kesilib qolmasligi uchun.
export const maxDuration = 60;
 
// Gemini API kaliti va model nomi FAQAT .env.local fayldan o'qiladi — kodga yozilmaydi,
// shunda GitHub'ga push qilsang ham kaliting ochilib qolmaydi (.env* .gitignore'da).
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
 
function modelForPlan(plan) {
  // Har bir tarif uchun alohida model belgilanishi mumkin (masalan GEMINI_MODEL_MAX).
  // Agar sozlanmagan bo'lsa, standart modelga tushadi — hech narsa buzilmaydi.
  return (plan?.modelEnv && process.env[plan.modelEnv]) || DEFAULT_MODEL;
}
 
// Lite tarifda TEZ javob berish ustuvor (kam "o'ylash"), yuqori tariflarda
// sifat ustuvor. Foydalanuvchi "Chuqur o'ylash"ni yoqsa, tarifidan qat'i
// nazar har doim 'high' ishlatiladi.
function thinkingLevelForPlan(planId) {
  if (planId === 'lite') return 'low';
  if (planId === 'pro') return 'medium';
  return 'high'; // max, promax
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
  const { text, image, pdf, previousInteractionId, profile: clientProfile, deepThink } = await req.json();
 
  if (!text && !image && !pdf) {
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
    const imagePrompt = imageCommandMatch[1].trim();
    const encoder = new TextEncoder();
 
    const readable = new ReadableStream({
      async start(controller) {
        function send(obj) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        }
 
        try {
          send({ type: 'chunk', text: 'Rasm chizilmoqda, biroz kuting... 🎨' });
 
          // Max va Pro Max obunachilari uchun — ular allaqachon pullik tarifda,
          // shuning uchun ularga sifatliroq (lekin bizga xarajat qiladigan)
          // Gemini rasm modeli beriladi. Qolgan hamma (Lite/Pro) uchun —
          // bepul Pollinations.ai ishlatiladi.
          const isPremiumImagePlan = ['max', 'promax'].includes(effectivePlan.plan?.id);
 
          let result;
          if (isPremiumImagePlan) {
            try {
              result = await generateImageViaGemini(ai, imagePrompt);
            } catch (geminiError) {
              // Gemini ishlamasa (masalan billing yoqilmagan bo'lsa) — foydalanuvchiga
              // xato ko'rsatmasdan, bepul Pollinations'ga tushib qolamiz.
              console.error("Gemini rasm modeli ishlamadi, Pollinations'ga o'tildi:", geminiError);
            }
          }
          if (!result) {
            result = await generateImageViaPollinations(imagePrompt);
          }
 
          const dataUrl = `data:${result.mimeType};base64,${result.base64}`;
 
          send({
            type: 'done',
            text: 'Mana, tayyor! 🖼️',
            image: { dataUrl, mimeType: result.mimeType },
            plan: applyUsage(),
          });
        } catch (error) {
          console.error('Rasm yaratishda xato:', error);
          send({ type: 'error', message: error.message || 'Rasm yaratishda xatolik yuz berdi.' });
        } finally {
          controller.close();
        }
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
 
  // "/prezentatsiya <mavzu>" yoki "/taqdimot <mavzu>" — haqiqiy .pptx fayl yaratish.
  const presentationMatch = text?.trim().match(PRESENTATION_COMMAND_RE);
  if (presentationMatch) {
    const topic = presentationMatch[2].trim();
    const encoder = new TextEncoder();
 
    const readable = new ReadableStream({
      async start(controller) {
        function send(obj) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        }
 
        try {
          send({ type: 'chunk', text: 'Prezentatsiya tayyorlanmoqda, biroz kuting... 📊' });
 
          const MODEL = effectivePlan.plan ? modelForPlan(effectivePlan.plan) : DEFAULT_MODEL;
          const { base64, filename, title, slideCount } = await generatePresentation(ai, MODEL, topic);
 
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
        } catch (error) {
          console.error('Prezentatsiya yaratishda xato:', error);
          send({ type: 'error', message: error.message || 'Prezentatsiya yaratishda xatolik yuz berdi.' });
        } finally {
          controller.close();
        }
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
 
  // PDF biriktirilgan bo'lsa — matnini shu yerda (serverda) chiqarib olamiz,
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
 
  const textWithPdf = `${text || (pdf?.data ? 'Bu PDF faylda nima yozilganini tushuntirib ber.' : '')}${pdfSection}`;
 
  const input = image?.data
    ? [
        { type: 'text', text: textWithPdf || 'Bu rasmda nima borligini aytib ber.' },
        { type: 'image', data: image.data, mime_type: image.mimeType },
      ]
    : textWithPdf;
 
  const systemInstruction = buildSystemInstruction(profile, profile?.til);
  const MODEL = effectivePlan.plan ? modelForPlan(effectivePlan.plan) : DEFAULT_MODEL;
  const thinkingLevel = deepThink ? 'high' : thinkingLevelForPlan(effectivePlan.plan?.id);
 
  async function openStream(prevId) {
    return ai.interactions.create({
      model: MODEL,
      input,
      system_instruction: systemInstruction,
      previous_interaction_id: prevId || undefined,
      stream: true,
      generation_config: {
        max_output_tokens: 4096,
        thinking_level: thinkingLevel,
      },
    });
  }
 
  const encoder = new TextEncoder();
  // Oxirgi ~100 belgini har doim "xavfsiz zaxira"da ushlab turamiz — chunki yashirin
  // [[ESLA: ...]] belgisi javobning aynan oxirida chiqadi va foydalanuvchiga hech qachon
  // ko'rsatilmasligi kerak. Stream tugagach, to'liq tozalangan matn bilan almashtiramiz.
  const SAFE_TAIL = 100;
 
  const readable = new ReadableStream({
    async start(controller) {
      function send(obj) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }
 
      let fullText = '';
      let emittedUpTo = 0;
      let interactionId = null;
 
      try {
        let stream;
        try {
          stream = await openStream(previousInteractionId);
        } catch (err) {
          if (previousInteractionId) {
            stream = await openStream(null);
          } else {
            throw err;
          }
        }
 
        for await (const event of stream) {
          // MUHIM: Interactions API'da chat ID'si event.interaction.id ichida keladi,
          // event.id emas — shu xato tufayli suhbat tarixi hech qachon davom etmagan.
          if (event?.interaction?.id) interactionId = event.interaction.id;
          if (event?.event_type === 'step.delta' && event?.delta?.type === 'text') {
            fullText += event.delta.text;
            const safeLen = Math.max(0, fullText.length - SAFE_TAIL);
            if (safeLen > emittedUpTo) {
              send({ type: 'chunk', text: fullText.slice(emittedUpTo, safeLen) });
              emittedUpTo = safeLen;
            }
          }
        }
 
        const { facts, cleanText } = extractFacts(fullText);
 
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
          plan: applyUsage(),
        });
      } catch (error) {
        console.error('API Error:', error);
        send({ type: 'error', message: error.message || 'Server xatosi' });
      } finally {
        controller.close();
      }
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
 