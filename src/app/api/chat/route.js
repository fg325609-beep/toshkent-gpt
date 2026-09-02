import { GoogleGenAI } from '@google/genai';
import pptxgen from 'pptxgenjs';
import { extractText, getDocumentProxy } from 'unpdf';
import { auth } from '@/auth';
import { getUserState, resolveEffectivePlan, getUsageWindow, recordUsage, saveUserState } from '../_lib/user-plan';
import { getUserProfile, mergeUserProfile } from '../_lib/user-profile';
import { touchUser } from '../_lib/admin';
 
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
 
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}
 
const BASE_STYLE = `Sen haqiqiy toshkentlik yigitsan. Isming - ToshkentGPT. Foydalanuvchi bilan 'jigar', 'brat', 'chotki', 'qalay' kabi so'zlarni ishlatib, samimiy va hazil-mutoyiba bilan gaplashasan. Juda rasmiy bo'lma, xuddi yaqin o'rtog'ing bilan choyxonada suhbatlashayotgandek erkin, sodda va qisqa javob ber. Agar rasm yoki fayl yuborilsa, uning mazmuni haqida ham shu uslubda gapirib ber. Kod yozishing kerak bo'lsa, har doim markdown kod bloklaridan (uch qiyshiq chiziq bilan) foydalan. Senda internetdan QIDIRISH imkoniyati bor — agar savol joriy/yangi ma'lumot talab qilsa (masalan bugungi kurs, ob-havo, so'nggi yangiliklar, hozirgi narxlar, kim g'olib chiqdi kabi), albatta qidiruvdan foydalanib, ANIQ va YANGI ma'lumot ber. "Menda real vaqt ma'lumoti yo'q" deb aytma — senda bor, undan foydalan.`;
 
// "/rasm <tavsif>" buyrug'ini aniqlash uchun. Masalan: "/rasm mushuk kosmik kostyumda"
const IMAGE_COMMAND_RE = /^\/rasm\s+([\s\S]+)/i;
// Rasm yaratish IKKI XIL YO'L bilan ishlaydi (pastdagi POST funksiyasida tanlanadi):
//  - Lite/Pro (bepul/arzon tarif) -> Pollinations.ai — to'liq bepul, API kalit kerak emas.
//  - Max/Pro Max (yuqori tarif)   -> Gemini'ning o'z rasm modeli — sifatliroq,
//    lekin bizga (loyiha egasiga) pul turadi, shuning uchun faqat eng yuqori
//    ikkita tarifga beriladi. Buning uchun Google hisobingizda billing
//    yoqilgan bo'lishi SHART, aks holda xato chiqadi.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
 
// "/prezentatsiya <mavzu>" — haqiqiy yuklab olinadigan .pptx fayl yaratish uchun.
// Avval Gemini'dan taqdimot mazmunini QATTIQ JSON shaklida so'raymiz, keyin shu
// JSON'ni pptxgenjs orqali chinakam PowerPoint faylga aylantiramiz.
const PRESENTATION_COMMAND_RE = /^\/(prezentatsiya|taqdimot)\s+([\s\S]+)/i;
const PRESENTATION_JSON_PROMPT = (topic) => `Sen taqdimot (prezentatsiya) tuzuvchi yordamchisan. Talaba/o'quvchi uchun "${topic}" mavzusida oʻzbek tilida, aniq va bilimga boy taqdimot tuzib ber.
 
FAQAT quyidagi JSON formatida javob ber — hech qanday qo'shimcha matn, izoh yoki markdown belgisi (masalan \`\`\`json) YOZMA, faqat toza JSON:
 
{
  "title": "Taqdimot sarlavhasi (qisqa, aniq)",
  "subtitle": "Bir qatorlik qisqacha tavsif",
  "slides": [
    { "heading": "Slayd sarlavhasi", "bullets": ["Band 1", "Band 2", "Band 3"] }
  ]
}
 
Qoidalar: 6 dan 9 tagacha kontent slayd yarat (title slaydidan tashqari). Har bir slaydda 3 tadan 5 tagacha qisqa, aniq band (bullet) bo'lsin — har bir band 1 qator, 12 so'zdan oshmasin. Mavzuni boshidan oxirigacha mantiqiy ketma-ketlikda yorit (kirish -> asosiy qismlar -> xulosa).`;
 
// Foydalanuvchi haqida bilib olingan doimiy faktlarni (ism, shahar va h.k.) yashirin
// belgi orqali ajratib olish uchun format: [[ESLA: kalit=qiymat]]
const FACT_TAG_RE = /\[\[ESLA:\s*([^=\]]+)=([^\]]+)\]\]/gi;
 
const LANGUAGE_INSTRUCTIONS = {
  ru: "\n\nMUHIM — TIL: Foydalanuvchi rus tilida javob olishni tanlagan. Barcha javoblaringni albatta RUS TILIDA yoz (o'zbekcha emas), lekin ToshkentGPT xarakteringni (samimiy, hazil-mutoyiba, do'stona ohang) saqlab qol.",
  en: "\n\nIMPORTANT — LANGUAGE: The user has chosen to receive replies in English. Always write your replies in ENGLISH (not Uzbek), while keeping your ToshkentGPT personality (warm, playful, friendly tone).",
};
// Til "avtomatik" bo'lsa (yoki umuman tanlanmagan bo'lsa) — standart o'zbekcha
// uslubda javob beramiz, lekin foydalanuvchi boshqa tilda yozsa, shu tilga
// moslashamiz (majburiy tarjima qilib o'tirmaymiz).
const AUTO_LANGUAGE_INSTRUCTION =
  "\n\nAgar foydalanuvchi xabarni rus yoki ingliz (yoki boshqa) tilda yozsa, sen ham javobni O'SHA TILDA yoz — majburan o'zbek tiliga tarjima qilib o'tirma.";
 
function buildSystemInstruction(profile, language) {
  const entries = Object.entries(profile || {}).filter(([, v]) => v);
  const knownLine = entries.length
    ? `\n\nFoydalanuvchi haqida oldindan ma'lum faktlar: ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}. Mos kelganda shulardan tabiiy foydalan (masalan ismi bilan chaqirish), lekin har gal takrorlab o'tirma.`
    : '';
 
  const captureInstruction = `\n\nAgar foydalanuvchi shu xabarida ismini yoki boshqa doimiy shaxsiy ma'lumotini (masalan: ism, yashash joyi, kasbi, yoshi, yoqtirgan narsasi) birinchi marta aytsa, javobingning ENG OXIRIGA, alohida qatorda, aynan shu formatda yashirin belgi qo'sh: [[ESLA: kalit=qiymat]] — masalan [[ESLA: ism=Ali]]. Bir nechta fakt bo'lsa, har birini alohida qatorga yoz. Agar hech qanday yangi shaxsiy fakt aytilmagan bo'lsa yoki u allaqachon ma'lum bo'lsa, bunday qator umuman qo'shma. Bu qatorlar foydalanuvchiga hech qachon ko'rsatilmaydi.`;
 
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language] || AUTO_LANGUAGE_INSTRUCTION;
 
  return `${BASE_STYLE}${knownLine}${captureInstruction}${languageInstruction}`;
}
 
function extractFacts(rawText) {
  const facts = {};
  const re = new RegExp(FACT_TAG_RE);
  let match;
  while ((match = re.exec(rawText)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value) facts[key] = value;
  }
  const cleanText = rawText.replace(FACT_TAG_RE, '').trim();
  return { facts, cleanText };
}
 
export async function POST(req) {
  const { text, image, pdf, previousInteractionId, profile: clientProfile } = await req.json();
 
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
 
  // "/rasm <tavsif>" — AI orqali rasm chizib berish buyrug'i. Oddiy matn suhbatidan
  // butunlay boshqacha (Imagen modeli, streaming yo'q) bo'lgani uchun alohida
  // yo'l (branch) sifatida, eng boshida ajratib olinadi.
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
 
          let dataUrl;
          let mimeType;
 
          if (isPremiumImagePlan) {
            try {
              const result = await ai.models.generateContent({
                model: IMAGE_MODEL,
                contents: imagePrompt,
              });
 
              const parts = result?.candidates?.[0]?.content?.parts || [];
              const imagePart = parts.find((p) => p.inlineData?.data);
              if (!imagePart) throw new Error('Gemini rasm qaytarmadi');
 
              mimeType = imagePart.inlineData.mimeType || 'image/png';
              dataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
            } catch (geminiError) {
              // Gemini ishlamasa (masalan billing yoqilmagan bo'lsa) — foydalanuvchiga
              // xato ko'rsatmasdan, bepul Pollinations'ga tushib qolamiz.
              console.error("Gemini rasm modeli ishlamadi, Pollinations'ga o'tildi:", geminiError);
            }
          }
 
          if (!dataUrl) {
            const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&enhance=true`;
            const imgRes = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(60000) });
 
            if (!imgRes.ok) {
              throw new Error(`Rasm yaratib bo'lmadi (server javobi: ${imgRes.status}) — birozdan keyin qayta urinib ko'r.`);
            }
 
            const arrayBuffer = await imgRes.arrayBuffer();
            mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
            dataUrl = `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
          }
 
          // Rasm ham "bitta xabar" sifatida kunlik limitga qo'shiladi — matnli
          // xabar bilan bir xil hisoblash yo'li ishlatiladi.
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
 
          send({
            type: 'done',
            text: 'Mana, tayyor! 🖼️',
            image: { dataUrl, mimeType },
            plan: planPayload,
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
 
          // 1-qadam: mazmunni Gemini'dan QATTIQ JSON shaklida olamiz.
          const MODEL = effectivePlan.plan ? modelForPlan(effectivePlan.plan) : DEFAULT_MODEL;
          const contentResult = await ai.models.generateContent({
            model: MODEL,
            contents: PRESENTATION_JSON_PROMPT(topic),
          });
 
          const rawJson = (contentResult?.text || contentResult?.candidates?.[0]?.content?.parts?.[0]?.text || '')
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '');
 
          let data;
          try {
            data = JSON.parse(rawJson);
          } catch {
            throw new Error("Taqdimot mazmunini tushunib bo'lmadi — birozdan keyin qayta urinib ko'r.");
          }
 
          if (!data?.slides?.length) {
            throw new Error("Taqdimot uchun mazmun topilmadi — birozdan keyin qayta urinib ko'r.");
          }
 
          // 2-qadam: JSON'ni chinakam .pptx faylga aylantiramiz.
          const pres = new pptxgen();
          pres.defineLayout({ name: 'TOSHKENTGPT', width: 10, height: 5.63 });
          pres.layout = 'TOSHKENTGPT';
 
          const titleSlide = pres.addSlide();
          titleSlide.background = { color: '0D0F14' };
          titleSlide.addText(data.title || topic, {
            x: 0.6, y: 2, w: 8.8, h: 1.3, fontSize: 34, bold: true, color: 'E4A93B', align: 'center',
          });
          if (data.subtitle) {
            titleSlide.addText(data.subtitle, {
              x: 0.6, y: 3.3, w: 8.8, h: 0.6, fontSize: 16, color: 'FFFFFF', align: 'center',
            });
          }
          titleSlide.addText('ToshkentGPT', {
            x: 0.6, y: 5.0, w: 8.8, h: 0.4, fontSize: 11, color: '2F9E96', align: 'center',
          });
 
          for (const slide of data.slides) {
            const s = pres.addSlide();
            s.background = { color: 'FFFFFF' };
            s.addText(slide.heading || '', {
              x: 0.5, y: 0.35, w: 9, h: 0.8, fontSize: 24, bold: true, color: '2F9E96',
            });
            const bullets = (slide.bullets || []).map((b) => ({ text: b, options: { bullet: true, breakLine: true } }));
            if (bullets.length) {
              s.addText(bullets, { x: 0.6, y: 1.3, w: 8.8, h: 3.9, fontSize: 17, color: '0D0F14' });
            }
          }
 
          const base64 = await pres.write({ outputType: 'base64' });
          const safeFilename = `${(data.title || topic).slice(0, 60).replace(/[^\p{L}\p{N}\s-]/gu, '').trim() || 'prezentatsiya'}.pptx`;
 
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
 
          send({
            type: 'done',
            text: `Mana, tayyor! 📊 "${data.title || topic}" — ${data.slides.length + 1} slayd.`,
            file: {
              base64,
              filename: safeFilename,
              mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            },
            plan: planPayload,
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
 
  async function openStream(prevId) {
    return ai.interactions.create({
      model: MODEL,
      input,
      system_instruction: systemInstruction,
      previous_interaction_id: prevId || undefined,
      stream: true,
      generation_config: {
        max_output_tokens: 4096,
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
          console.log('[DEBUG event]', event?.event_type, '| delta.type:', event?.delta?.type, '| keys:', Object.keys(event || {}));
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
        console.log('[DEBUG] fullText length at end:', fullText.length);
 
        const { facts, cleanText } = extractFacts(fullText);
 
        // Yangi bilib olingan faktlar (ism va h.k.) bor bo'lsa — Redis'ga ham yozib
        // qo'yamiz, shunda foydalanuvchi boshqa qurilmadan kirsa ham eslab qoladi.
        // Xato bo'lsa ham (masalan Redis ulanmagan) javobni to'sib qo'ymaymiz.
        if (email && Object.keys(facts).length) {
          mergeUserProfile(email, facts).catch((err) => console.error('Profil saqlashda xato:', err));
        }
 
        let planPayload;
        if (email && userState && effectivePlan.plan) {
          recordUsage(userState, usageCooldownHours);
          // Xabar hisobini saqlashda xato bo'lsa ham, foydalanuvchiga javobni to'sib qo'ymaymiz.
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
 
        send({
          type: 'done',
          text: cleanText || 'Javob kelmadi.',
          interactionId,
          facts: Object.keys(facts).length ? facts : undefined,
          plan: planPayload,
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
 