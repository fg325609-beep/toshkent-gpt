import { GoogleGenAI } from '@google/genai';
import { getRedis } from '../../_lib/redis';
import { getUserState, resolveEffectivePlan, getUsageWindow, recordUsage, saveUserState } from '../../_lib/user-plan';
import { getUserProfile, mergeUserProfile } from '../../_lib/user-profile';
import { touchUser } from '../../_lib/admin';
import {
  IMAGE_COMMAND_RE,
  PRESENTATION_COMMAND_RE,
  buildSystemInstruction,
  extractFacts,
  generateImageViaPollinations,
  generateImageViaGemini,
  generatePresentation,
} from '../../_lib/ai-generation';
import { sendTelegramMessage, sendTelegramPhoto, sendTelegramDocument, sendTelegramChatAction } from '../../_lib/telegram';
 
// ============================================================
// Telegram bot — /api/chat (veb-chat) bilan BIR XIL AI mantig'ini
// (_lib/ai-generation.js, _lib/user-plan.js) ishlatadi, shunda ikkalasida
// alohida-alohida yozilgan, bir-biridan farq qiladigan kod bo'lmaydi.
//
// Ishlash tartibi:
// 1. Telegram foydalanuvchisi saytda "Telegram bilan bog'lash" tugmasini
//    bosadi -> vaqtinchalik token yaratiladi -> Telegram botga
//    "/start <token>" sifatida yuboriladi -> shu yerda token email'ga
//    almashtiriladi va DOIMIY bog'lanadi (tg:telegram-link:<tgUserId>).
// 2. Bog'langandan keyin, Telegram'dagi har bir xabar saytdagi bilan BIR
//    XIL profil, tarif va kunlik limitni ishlatadi — lekin suhbat "ipi"
//    (interaction thread) saytdan ALOHIDA saqlanadi, chunki ikki platforma
//    orasida bitta jonli suhbatni "ulab" olib borish County ancha
//    murakkab va ishonchsiz bo'lardi.
// ============================================================
 
export const maxDuration = 60;
 
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const SITE_URL = 'https://toshkent-gpt.vercel.app';
 
const linkTokenKey = (token) => `tg:tglink-token:${token}`;
const linkedEmailKey = (tgUserId) => `tg:telegram-link:${tgUserId}`;
const sessionKey = (tgUserId) => `tg:telegram-session:${tgUserId}`;
 
function modelForPlan(plan) {
  return (plan?.modelEnv && process.env[plan.modelEnv]) || DEFAULT_MODEL;
}
 
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}
 
export async function POST(req) {
  // Xavfsizlik: agar TELEGRAM_WEBHOOK_SECRET sozlangan bo'lsa, faqat shu
  // maxfiy tokenni yuborgan so'rovlar (ya'ni haqiqiy Telegram serveri)
  // qabul qilinadi — begona odam soxta so'rov yubora olmaydi.
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
 
  const update = await req.json().catch(() => null);
  const message = update?.message;
  if (!message?.chat?.id) {
    return Response.json({ ok: true });
  }
 
  const chatId = message.chat.id;
  const tgUserId = String(message.from?.id || chatId);
  const text = (message.text || '').trim();
  const redis = getRedis();
 
  if (!redis) {
    await sendTelegramMessage(chatId, "Server vaqtincha ishlamayapti, birozdan keyin urinib ko'r.");
    return Response.json({ ok: true });
  }
 
  // --- "/start" yoki "/start <token>" — hisobni bog'lash ---
  if (text.startsWith('/start')) {
    const token = text.split(/\s+/)[1];
 
    if (token) {
      const email = await redis.get(linkTokenKey(token));
      if (email) {
        await redis.set(linkedEmailKey(tgUserId), email);
        await redis.del(linkTokenKey(token));
        await sendTelegramMessage(
          chatId,
          "✅ Hisobingiz muvaffaqiyatli bog'landi, jigar!\n\nEndi menga to'g'ridan-to'g'ri yozishing mumkin — saytdagi bilan bir xil profil va tarifing ishlaydi. /rasm va /prezentatsiya buyruqlari ham shu yerda ishlaydi."
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `Bu havola eskirgan yoki noto'g'ri (10 daqiqadan keyin muddati tugaydi). Saytga qayta kirib, Sozlamalar → "Telegram bilan bog'lash"ni bosing:\n${SITE_URL}`
        );
      }
      return Response.json({ ok: true });
    }
 
    await sendTelegramMessage(
      chatId,
      `Salom, men ToshkentGPT — koʻcha tilida gaplashadigan yordamchiman! 🤖\n\nMendan foydalanish uchun avval hisobingizni bog'lashingiz kerak:\n1. Saytga kiring: ${SITE_URL}\n2. Sozlamalar (⚙️) tugmasini bosing\n3. "Telegram bilan bog'lash"ni tanlang`
    );
    return Response.json({ ok: true });
  }
 
  const email = await redis.get(linkedEmailKey(tgUserId));
  if (!email) {
    await sendTelegramMessage(
      chatId,
      `Hali hisobingiz bog'lanmagan, jigar 🙂\n\nSaytga kiring → Sozlamalar (⚙️) → "Telegram bilan bog'lash":\n${SITE_URL}`
    );
    return Response.json({ ok: true });
  }
 
  if (message.photo || message.document) {
    await sendTelegramMessage(
      chatId,
      "Hozircha Telegram orqali rasm/fayl yuborishni tushunmayman — faqat matnli xabar, /rasm va /prezentatsiya buyruqlari ishlaydi. Rasm tahlili uchun saytdan foydalaning 🙂"
    );
    return Response.json({ ok: true });
  }
 
  if (!text) {
    return Response.json({ ok: true });
  }
 
  if (!API_KEY) {
    await sendTelegramMessage(chatId, "Server sozlanmagan (API kalit yo'q).");
    return Response.json({ ok: true });
  }
 
  await sendTelegramChatAction(chatId, 'typing');
  touchUser(email, {}).catch(() => {});
 
  const profile = (await getUserProfile(email).catch(() => null)) || {};
 
  const userState = await getUserState(email);
  const effectivePlan = resolveEffectivePlan(userState);
  const { plan, mode } = effectivePlan;
 
  if (mode === 'downgraded') {
    const unlockLabel = effectivePlan.unlockAt
      ? ` Soat ${formatTime(effectivePlan.unlockAt)}da yana bepul sinab ko'rishingiz mumkin.`
      : '';
    await sendTelegramMessage(chatId, `${effectivePlan.wantedPlan?.name || 'Tarifingiz'} vaqti tugadi.${unlockLabel} Saytdan tarifni yangilang.`);
    return Response.json({ ok: true });
  }
 
  const usageCooldownHours = mode === 'trial' ? plan.trial?.cooldownHours : undefined;
  const usageLimit = mode === 'trial' ? plan.trial.limit : plan.dailyLimit;
  const win = getUsageWindow(userState, usageCooldownHours);
 
  if (win.count >= usageLimit) {
    const unlockLabel = win.unlockAt ? ` Soat ${formatTime(win.unlockAt)}da yana ishlata olasiz.` : ' Ertaga davom eting yoki tarifni oshiring.';
    await sendTelegramMessage(chatId, `"${plan.name}" limitiga (${usageLimit} xabar) yetdingiz.${unlockLabel}`);
    return Response.json({ ok: true });
  }
 
  const ai = new GoogleGenAI({ apiKey: API_KEY });
 
  function applyUsage() {
    recordUsage(userState, usageCooldownHours);
    saveUserState(email, userState).catch((err) => console.error('Limit saqlashda xato:', err));
  }
 
  // --- "/rasm <tavsif>" ---
  const imageCommandMatch = text.match(IMAGE_COMMAND_RE);
  if (imageCommandMatch) {
    const imagePrompt = imageCommandMatch[1].trim();
    try {
      await sendTelegramChatAction(chatId, 'upload_photo');
      const isPremiumImagePlan = ['max', 'promax'].includes(plan?.id);
 
      let result;
      if (isPremiumImagePlan) {
        try {
          result = await generateImageViaGemini(ai, imagePrompt);
        } catch (err) {
          console.error("Gemini rasm modeli ishlamadi, Pollinations'ga o'tildi:", err);
        }
      }
      if (!result) result = await generateImageViaPollinations(imagePrompt);
 
      const buffer = result.arrayBuffer ? Buffer.from(result.arrayBuffer) : Buffer.from(result.base64, 'base64');
      await sendTelegramPhoto(chatId, buffer, 'Mana, tayyor! 🖼️');
      applyUsage();
    } catch (error) {
      console.error('Telegram rasm yaratishda xato:', error);
      await sendTelegramMessage(chatId, error.message || 'Rasm yaratishda xatolik yuz berdi.');
    }
    return Response.json({ ok: true });
  }
 
  // --- "/prezentatsiya <mavzu>" yoki "/taqdimot <mavzu>" ---
  const presentationMatch = text.match(PRESENTATION_COMMAND_RE);
  if (presentationMatch) {
    const topic = presentationMatch[2].trim();
    try {
      await sendTelegramChatAction(chatId, 'upload_document');
      const MODEL = plan ? modelForPlan(plan) : DEFAULT_MODEL;
      const { base64, filename, title, slideCount } = await generatePresentation(ai, MODEL, topic);
      await sendTelegramDocument(chatId, Buffer.from(base64, 'base64'), filename, `Mana, tayyor! 📊 "${title}" — ${slideCount} slayd.`);
      applyUsage();
    } catch (error) {
      console.error('Telegram prezentatsiya yaratishda xato:', error);
      await sendTelegramMessage(chatId, error.message || 'Prezentatsiya yaratishda xatolik yuz berdi.');
    }
    return Response.json({ ok: true });
  }
 
  // --- Oddiy matnli suhbat ---
  try {
    const systemInstruction = buildSystemInstruction(profile, profile?.til);
    const MODEL = plan ? modelForPlan(plan) : DEFAULT_MODEL;
 
    const sessionRaw = await redis.get(sessionKey(tgUserId));
    const tgSession = sessionRaw ? (typeof sessionRaw === 'string' ? JSON.parse(sessionRaw) : sessionRaw) : {};
    const previousInteractionId = tgSession.lastInteractionId || null;
 
    async function openStream(prevId) {
      return ai.interactions.create({
        model: MODEL,
        input: text,
        system_instruction: systemInstruction,
        previous_interaction_id: prevId || undefined,
        stream: true,
        generation_config: { max_output_tokens: 4096 },
      });
    }
 
    let stream;
    try {
      stream = await openStream(previousInteractionId);
    } catch (err) {
      if (previousInteractionId) stream = await openStream(null);
      else throw err;
    }
 
    let fullText = '';
    let interactionId = null;
    for await (const event of stream) {
      if (event?.interaction?.id) interactionId = event.interaction.id;
      if (event?.event_type === 'step.delta' && event?.delta?.type === 'text') {
        fullText += event.delta.text;
      }
    }
 
    const { facts, cleanText } = extractFacts(fullText);
 
    if (Object.keys(facts).length) {
      mergeUserProfile(email, facts).catch((err) => console.error('Profil saqlashda xato:', err));
    }
    if (interactionId) {
      await redis.set(sessionKey(tgUserId), JSON.stringify({ lastInteractionId: interactionId }));
    }
 
    await sendTelegramMessage(chatId, cleanText);
    applyUsage();
  } catch (error) {
    console.error('Telegram chat xatosi:', error);
    await sendTelegramMessage(chatId, "Kechirasan jigar, xatolik yuz berdi. Birozdan keyin qayta urinib ko'r.");
  }
 
  return Response.json({ ok: true });
}
 
// Telegram webhook manzilini tekshirish uchun (brauzerda ochib ko'rsa, xato bermasin).
export async function GET() {
  return Response.json({ ok: true, message: 'ToshkentGPT Telegram webhook ishlamoqda.' });
}
 