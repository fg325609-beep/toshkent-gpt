import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { getUserState, resolveEffectivePlan, getUsageWindow, recordUsage, saveUserState } from '../_lib/user-plan';
import { mergeUserProfile } from '../_lib/user-profile';

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

const BASE_STYLE = `Sen haqiqiy toshkentlik yigitsan. Isming - ToshkentGPT. Foydalanuvchi bilan 'jigar', 'brat', 'chotki', 'qalay' kabi so'zlarni ishlatib, samimiy va hazil-mutoyiba bilan gaplashasan. Juda rasmiy bo'lma, xuddi yaqin o'rtog'ing bilan choyxonada suhbatlashayotgandek erkin, sodda va qisqa javob ber. Agar rasm yoki fayl yuborilsa, uning mazmuni haqida ham shu uslubda gapirib ber. Kod yozishing kerak bo'lsa, har doim markdown kod bloklaridan (uch qiyshiq chiziq bilan) foydalan.`;

// Foydalanuvchi haqida bilib olingan doimiy faktlarni (ism, shahar va h.k.) yashirin
// belgi orqali ajratib olish uchun format: [[ESLA: kalit=qiymat]]
const FACT_TAG_RE = /\[\[ESLA:\s*([^=\]]+)=([^\]]+)\]\]/gi;

function buildSystemInstruction(profile) {
  const entries = Object.entries(profile || {}).filter(([, v]) => v);
  const knownLine = entries.length
    ? `\n\nFoydalanuvchi haqida oldindan ma'lum faktlar: ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}. Mos kelganda shulardan tabiiy foydalan (masalan ismi bilan chaqirish), lekin har gal takrorlab o'tirma.`
    : '';

  const captureInstruction = `\n\nAgar foydalanuvchi shu xabarida ismini yoki boshqa doimiy shaxsiy ma'lumotini (masalan: ism, yashash joyi, kasbi, yoshi, yoqtirgan narsasi) birinchi marta aytsa, javobingning ENG OXIRIGA, alohida qatorda, aynan shu formatda yashirin belgi qo'sh: [[ESLA: kalit=qiymat]] — masalan [[ESLA: ism=Ali]]. Bir nechta fakt bo'lsa, har birini alohida qatorga yoz. Agar hech qanday yangi shaxsiy fakt aytilmagan bo'lsa yoki u allaqachon ma'lum bo'lsa, bunday qator umuman qo'shma. Bu qatorlar foydalanuvchiga hech qachon ko'rsatilmaydi.`;

  return `${BASE_STYLE}${knownLine}${captureInstruction}`;
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
  const { text, image, previousInteractionId, profile } = await req.json();

  if (!text && !image) {
    return Response.json({ response: 'Matn yoki rasm kiritilmadi!' }, { status: 400 });
  }

  if (!API_KEY) {
    return Response.json(
      { response: "Server sozlanmagan: .env.local faylida GEMINI_API_KEY yo'q." },
      { status: 500 }
    );
  }

  // Foydalanuvchini SERVER TOMONDA aniqlaymiz (session orqali) — mijoz (brauzer)
  // tomonidan yuborilgan email'ga ishonib bo'lmaydi, aks holda limitni chetlab o'tish oson bo'lardi.
  const session = await auth();
  const email = session?.user?.email || null;

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

  const input = image?.data
    ? [
        { type: 'text', text: text || 'Bu rasmda nima borligini aytib ber.' },
        { type: 'image', data: image.data, mime_type: image.mimeType },
      ]
    : text;

  const systemInstruction = buildSystemInstruction(profile);
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
