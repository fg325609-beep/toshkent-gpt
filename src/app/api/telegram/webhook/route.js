import { GoogleGenAI } from '@google/genai';
import { extractText, getDocumentProxy } from 'unpdf';
import { getRedis } from '../../_lib/redis';
import { getUserState, resolveEffectivePlan, getUsageWindow, recordUsage, saveUserState } from '../../_lib/user-plan';
import { getUserProfile, mergeUserProfile } from '../../_lib/user-profile';
import { touchUser } from '../../_lib/admin';
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
  DOCUMENT_TEXT_MAX,
} from '../../_lib/ai-generation';
import { generateImageViaLocal } from '../../_lib/local-image';
import { extractDocumentText } from '../../_lib/document-extract';
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
  sendTelegramChatAction,
  downloadTelegramFile,
} from '../../_lib/telegram';
import { isUserBlocked, containsProfanity, recordViolation } from '../../_lib/moderation';
import { recordEvent } from '../../_lib/stats';
import { getSettings } from '../../_lib/settings';
import { withRetry, friendlyAiError, autoToolsForPlan, STEP_STATUS_TEXT } from '../../_lib/ai-generation';

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
//    orasida bitta jonli suhbatni "ulab" olib borish ancha murakkab va
//    ishonchsiz bo'lardi.
// 3. Rasm va fayl (PDF, Word, Excel, matn) ham tushuniladi — saytdagi kabi.
//
// Buyruqlar: /start, /yangi, /holat, /yordam, /rasm, /qidir, /kod,
// /prezentatsiya (/taqdimot).
// ============================================================

export const maxDuration = 60;

const API_KEY = process.env.GEMINI_API_KEY;
const SITE_URL = 'https://toshkent-gpt.vercel.app';

const linkTokenKey = (token) => `tg:tglink-token:${token}`;
const linkedEmailKey = (tgUserId) => `tg:telegram-link:${tgUserId}`;
const sessionKey = (tgUserId) => `tg:telegram-session:${tgUserId}`;
const updateSeenKey = (updateId) => `tg:telegram-update:${updateId}`;

const HELP_TEXT = `Men ToshkentGPT — koʻcha tilida gaplashadigan AI yordamchiman 🤖

Shunchaki yozing — javob beraman. Rasm yoki fayl (PDF, Word, Excel, matn) yuborsangiz, mazmunini tushuntirib beraman.

Buyruqlar:
/rasm <tavsif> — rasm chizib beraman
/qidir <savol> — internetdan eng soʻnggi maʼlumotni topaman
/kod <masala> — Python kodini yozib, ishga tushirib beraman
/prezentatsiya <mavzu> — PowerPoint (.pptx) tayyorlayman
/klip <YouTube havola> — podkastdan hookʼli qisqa kliplar (Max/Pro Max)
/yangi — suhbatni boshidan boshlash (eski gaplarni unutaman)
/holat — tarif va bugungi limit
/yordam — shu roʻyxat

Sayt: ${SITE_URL}`;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Tashkent' });
}

// Telegram serveri 60 soniya ichida "ok" olmasa (masalan rasm chizish uzoq
// cho'zilsa), AYNAN SHU update'ni qayta yuboradi — natijada foydalanuvchi
// bitta savolga ikki-uch marta javob olar edi. Har bir update_id bir marta
// qayd qilinadi; takrori kelsa jimgina e'tiborsiz qoldiriladi.
async function isDuplicateUpdate(redis, updateId) {
  if (!redis || updateId === undefined || updateId === null) return false;
  try {
    const set = await redis.set(updateSeenKey(updateId), '1', { nx: true, ex: 60 * 60 * 6 });
    return set === null || set === false;
  } catch (err) {
    console.error('Telegram update dedup xatosi (davom etamiz):', err);
    return false;
  }
}

async function extractPdfText(buffer) {
  const pdfDoc = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdfDoc, { mergePages: true });
  return (text || '').trim();
}

/**
 * Telegram xabaridagi rasm yoki faylni yuklab olib, AI'ga yuboriladigan
 * ko'rinishga keltiradi:
 *   { image: { data, mimeType } }  — rasm (photo yoki image/* document)
 *   { docName, docText }            — PDF/DOCX/XLSX/matnli fayl
 *   { unsupported: 'sabab' }        — tushunilmaydigan tur
 */
async function resolveAttachment(message) {
  if (message.photo?.length) {
    const largest = message.photo[message.photo.length - 1];
    const { buffer } = await downloadTelegramFile(largest.file_id);
    return { image: { data: buffer.toString('base64'), mimeType: 'image/jpeg' } };
  }

  const doc = message.document;
  if (!doc) return {};

  const name = doc.file_name || 'fayl';
  const mime = (doc.mime_type || '').toLowerCase();
  const ext = name.toLowerCase().split('.').pop();

  if (mime.startsWith('image/') && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    const { buffer } = await downloadTelegramFile(doc.file_id);
    return { image: { data: buffer.toString('base64'), mimeType: mime } };
  }

  if (ext === 'pdf') {
    const { buffer } = await downloadTelegramFile(doc.file_id);
    return { docName: name, docText: await extractPdfText(buffer) };
  }

  if (['docx', 'xlsx', 'xls'].includes(ext)) {
    const { buffer } = await downloadTelegramFile(doc.file_id);
    return { docName: name, docText: await extractDocumentText(buffer.toString('base64'), name) };
  }

  if (['txt', 'md', 'json', 'csv', 'log'].includes(ext) || mime.startsWith('text/')) {
    const { buffer } = await downloadTelegramFile(doc.file_id);
    return { docName: name, docText: buffer.toString('utf8').slice(0, DOCUMENT_TEXT_MAX) };
  }

  return { unsupported: `"${name}" turidagi faylni o'qiy olmayman — PDF, Word (.docx), Excel (.xlsx), rasm yoki oddiy matnli fayl yuboring.` };
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
  // Rasm/faylga yozilgan izoh (caption) ham oddiy matn kabi ishlatiladi.
  const text = (message.text || message.caption || '').trim();
  const redis = getRedis();

  if (!redis) {
    await sendTelegramMessage(chatId, "Server vaqtincha ishlamayapti, birozdan keyin urinib ko'r.");
    return Response.json({ ok: true });
  }

  if (await isDuplicateUpdate(redis, update.update_id)) {
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
          `✅ Hisobingiz muvaffaqiyatli bog'landi, jigar!\n\nEndi menga to'g'ridan-to'g'ri yozishing mumkin — saytdagi bilan bir xil profil va tarifing ishlaydi.\n\n${HELP_TEXT}`
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

  if (text === '/yordam' || text === '/help') {
    await sendTelegramMessage(chatId, HELP_TEXT);
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

  if (await isUserBlocked(email)) {
    await sendTelegramMessage(chatId, "Qoidalarni buzganingiz uchun hisobingiz cheklangan. Savol bo'lsa, admin bilan bog'laning.");
    return Response.json({ ok: true });
  }

  const settings = await getSettings().catch(() => null);
  if (settings?.maintenance?.enabled) {
    await sendTelegramMessage(chatId, `🛠 ${settings.maintenance.message || 'Texnik ishlar olib borilmoqda — birozdan keyin qayting.'}`);
    return Response.json({ ok: true });
  }
  const startedAt = Date.now();

  // --- "/yangi" — suhbat ipini uzish (AI eski gaplarni unutadi) ---
  if (text === '/yangi' || text === '/new') {
    await redis.del(sessionKey(tgUserId));
    await sendTelegramMessage(chatId, "Bo'ldi, toza varaqdan boshladik 🧹 Nima gap?");
    return Response.json({ ok: true });
  }

  const hasAttachment = Boolean(message.photo?.length || message.document);
  if (!text && !hasAttachment) {
    // Stiker, ovozli xabar, joylashuv va h.k. — hozircha tushunilmaydi.
    if (message.voice || message.audio || message.video || message.video_note) {
      await sendTelegramMessage(chatId, "Ovozli va video xabarlarni hozircha Telegram orqali tushunmayman — matn yozing yoki saytdagi 🎤 tugmasidan foydalaning.");
    }
    return Response.json({ ok: true });
  }

  if (text && containsProfanity(text)) {
    const { count, blocked } = await recordViolation(email);
    if (blocked) {
      await sendTelegramMessage(chatId, "Nomaqbul til ishlatganingiz tufayli hisobingiz bloklandi.");
    } else {
      await sendTelegramMessage(chatId, `Iltimos, odobli til bilan gaplashaylik, jigar 🙏 (Ogohlantirish ${count}/3)`);
    }
    return Response.json({ ok: true });
  }

  if (!API_KEY) {
    await sendTelegramMessage(chatId, "Server sozlanmagan (API kalit yo'q).");
    return Response.json({ ok: true });
  }

  await sendTelegramChatAction(chatId, 'typing');
  touchUser(email, { name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') }).catch(() => {});

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

  // --- "/holat" — tarif va limit (xabar sarflamaydi) ---
  if (text === '/holat' || text === '/tarif' || text === '/status') {
    const lines = [
      `📊 Tarif: ${plan.name}${mode === 'trial' ? ' (bepul sinov)' : ''}`,
      `✉️ Bugun: ${win.count}/${usageLimit} xabar ishlatildi, ${Math.max(0, usageLimit - win.count)} ta qoldi`,
    ];
    if (win.unlockAt) lines.push(`⏰ Limit soat ${formatTime(win.unlockAt)}da yangilanadi`);
    if (userState.planExpiresAt && new Date(userState.planExpiresAt) > new Date()) {
      lines.push(`📅 Tarif muddati: ${formatDate(userState.planExpiresAt)} gacha`);
    }
    lines.push(`\nTarifni oshirish: ${SITE_URL}/tariflar`);
    await sendTelegramMessage(chatId, lines.join('\n'));
    return Response.json({ ok: true });
  }

  if (win.count >= usageLimit) {
    const unlockLabel = win.unlockAt ? ` Soat ${formatTime(win.unlockAt)}da yana ishlata olasiz.` : ' Ertaga davom eting yoki tarifni oshiring.';
    await sendTelegramMessage(chatId, `"${plan.name}" limitiga (${usageLimit} xabar) yetdingiz.${unlockLabel}`);
    return Response.json({ ok: true });
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const MODEL = plan ? modelForPlan(plan) : DEFAULT_MODEL;

  function applyUsage() {
    recordUsage(userState, usageCooldownHours);
    saveUserState(email, userState).catch((err) => console.error('Limit saqlashda xato:', err));
  }

  // --- "/klip <havola>" — podkast → klip (worker'da, tayyor bo'lgach shu chatga keladi) ---
  const clipMatch = text.match(/^\/klip(?:\s+([\s\S]+))?$/i);
  if (clipMatch) {
    if (settings?.features?.clips === false) {
      await sendTelegramMessage(chatId, "Podkast → klip vaqtincha o'chirilgan.");
      return Response.json({ ok: true });
    }
    const url = (clipMatch[1] || '').trim();
    const allowed = (process.env.CLIPS_ALLOWED_PLANS || 'max,promax').split(',').map((x) => x.trim());
    if (!allowed.includes(plan?.id)) {
      await sendTelegramMessage(chatId, `Podkast → klip faqat Max va Pro Max tariflarida. Tarifni oshirish: ${SITE_URL}/tariflar`);
      return Response.json({ ok: true });
    }
    if (!/^https?:\/\//i.test(url)) {
      await sendTelegramMessage(chatId, "Havolani ham yozing: /klip https://www.youtube.com/watch?v=...\n\nFaylni yuklash uchun saytdagi Podkast → klip bo'limidan foydalaning.");
      return Response.json({ ok: true });
    }
    const workerBase = (process.env.LOCAL_VIDEO_URL || '').replace(/\/$/, '');
    if (!workerBase) {
      await sendTelegramMessage(chatId, "Montaj worker'i hozircha sozlanmagan.");
      return Response.json({ ok: true });
    }
    try {
      const siteBase = process.env.NEXTAUTH_URL || process.env.AUTH_URL || SITE_URL;
      const res = await fetch(`${workerBase}/clips/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: process.env.WORKER_TOKEN || '',
          source_url: url,
          max_clip_seconds: 120,
          clip_count: 0, // avtomatik — podkast uzunligiga qarab
          aspect: '9:16',
          subtitles: true,
          language: 'auto',
          remove_pauses: true,
          smart_crop: true,
          quality: 'high',
          callback_url: `${siteBase.replace(/\/$/, '')}/api/clips/callback`,
          callback_token: process.env.WORKER_TOKEN || '',
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error || !data?.requestId) throw new Error(data?.error || 'worker javob bermadi');
      await redis.set(`tg:clipjob:${data.requestId}`, JSON.stringify({ chatId, email }), { ex: 60 * 60 * 24 });
      applyUsage();
      recordEvent({ channel: 'telegram', kind: 'klip', email, ok: true, ms: Date.now() - startedAt });
      await sendTelegramMessage(
        chatId,
        "⏳ Boshlandi! Videoni yuklab olib, transkripsiya qilib, eng kuchli momentlarni (2 daqiqagacha) kesaman — pauzalarsiz, subtitr va sarlavha bilan, yuzga qarab 9:16. Tayyor bo'lgach shu yerga yuboraman (uzun podkast bo'lsa 10–20 daqiqa)."
      );
    } catch (error) {
      console.error('Telegram /klip xatosi:', error);
      await sendTelegramMessage(chatId, "Montaj worker'iga ulanib bo'lmadi — u yoqilgan bo'lishi kerak. Birozdan keyin qayta urinib ko'ring.");
    }
    return Response.json({ ok: true });
  }
 
  // --- "/rasm <tavsif>" ---
  const imageCommandMatch = text.match(IMAGE_COMMAND_RE);
  if (imageCommandMatch) {
    if (settings?.features?.imageGen === false) {
      await sendTelegramMessage(chatId, "Rasm chizish vaqtincha o'chirilgan — birozdan keyin urinib ko'ring.");
      return Response.json({ ok: true });
    }
    const imagePrompt = imageCommandMatch[1].trim();
    try {
      await sendTelegramChatAction(chatId, 'upload_photo');
      // Saytdagi bilan bir xil yo'l: tarjima -> lokal worker -> Gemini -> Pollinations.
      const result = await generateImage(ai, {
        prompt: imagePrompt,
        model: MODEL,
        premium: ['max', 'promax'].includes(plan?.id),
        localProvider: generateImageViaLocal,
      });
      const buffer = result.arrayBuffer ? Buffer.from(result.arrayBuffer) : Buffer.from(result.base64, 'base64');
      await sendTelegramPhoto(chatId, buffer, 'Mana, tayyor! 🖼️');
      applyUsage();
      recordEvent({ channel: 'telegram', kind: 'rasm', email, ok: true, ms: Date.now() - startedAt });
    } catch (error) {
      console.error('Telegram rasm yaratishda xato:', error);
      recordEvent({ channel: 'telegram', kind: 'rasm', email, ok: false, ms: Date.now() - startedAt, error: error?.message });
      await sendTelegramMessage(chatId, "Rasm chizib bo'lmadi — birozdan keyin qayta urinib ko'ring.");
    }
    return Response.json({ ok: true });
  }

  // --- "/qidir <savol>" — internet qidiruv ---
  const searchMatch = text.match(SEARCH_COMMAND_RE);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    try {
      await sendTelegramChatAction(chatId, 'typing');
      const systemInstruction = buildSystemInstruction(profile, profile?.til);
      const answer = await withRetry((m) => performWebSearch(ai, m, query, systemInstruction), { model: MODEL });
      await sendTelegramMessage(chatId, answer);
      applyUsage();
      recordEvent({ channel: 'telegram', kind: 'qidir', email, ok: true, ms: Date.now() - startedAt, model: MODEL });
    } catch (error) {
      console.error('Telegram qidiruvda xato:', error);
      recordEvent({ channel: 'telegram', kind: 'qidir', email, ok: false, ms: Date.now() - startedAt, model: MODEL, error: error?.message });
      await sendTelegramMessage(chatId, friendlyAiError(error));
    }
    return Response.json({ ok: true });
  }

  // --- "/kod <masala>" — kod ishga tushirish ---
  const codeMatch = text.match(CODE_COMMAND_RE);
  if (codeMatch) {
    const task = codeMatch[1].trim();
    try {
      await sendTelegramChatAction(chatId, 'typing');
      const systemInstruction = buildSystemInstruction(profile, profile?.til);
      const { text: resultText, code, imageBase64 } = await withRetry((m) => executeCode(ai, m, task, systemInstruction), { model: MODEL });
      let finalText = resultText || '';
      if (code) finalText += `\n\n\`\`\`python\n${code}\n\`\`\``;
      if (imageBase64) {
        await sendTelegramPhoto(chatId, Buffer.from(imageBase64, 'base64'), finalText.slice(0, 1000) || 'Bajarildi.');
      } else {
        await sendTelegramMessage(chatId, finalText || 'Bajarildi.');
      }
      applyUsage();
      recordEvent({ channel: 'telegram', kind: 'kod', email, ok: true, ms: Date.now() - startedAt, model: MODEL });
    } catch (error) {
      console.error('Telegram kod ishga tushirishda xato:', error);
      recordEvent({ channel: 'telegram', kind: 'kod', email, ok: false, ms: Date.now() - startedAt, model: MODEL, error: error?.message });
      await sendTelegramMessage(chatId, friendlyAiError(error));
    }
    return Response.json({ ok: true });
  }

  // --- "/prezentatsiya <mavzu>" yoki "/taqdimot <mavzu>" ---
  const presentationMatch = text.match(PRESENTATION_COMMAND_RE);
  if (presentationMatch) {
    const topic = presentationMatch[2].trim();
    try {
      await sendTelegramChatAction(chatId, 'upload_document');
      const { base64, filename, title, slideCount } = await withRetry((m) => generatePresentation(ai, m, topic), { model: MODEL });
      await sendTelegramDocument(chatId, Buffer.from(base64, 'base64'), filename, `Mana, tayyor! 📊 "${title}" — ${slideCount} slayd.`);
      applyUsage();
      recordEvent({ channel: 'telegram', kind: 'prezentatsiya', email, ok: true, ms: Date.now() - startedAt, model: MODEL });
    } catch (error) {
      console.error('Telegram prezentatsiya yaratishda xato:', error);
      recordEvent({ channel: 'telegram', kind: 'prezentatsiya', email, ok: false, ms: Date.now() - startedAt, model: MODEL, error: error?.message });
      await sendTelegramMessage(chatId, friendlyAiError(error));
    }
    return Response.json({ ok: true });
  }

  // --- Oddiy matnli suhbat (rasm/fayl bilan yoki usiz) ---
  try {
    // Rasm yoki faylni avval yuklab olamiz — xato bo'lsa, foydalanuvchiga
    // tushunarli xabar beriladi va limit sarflanmaydi.
    let attachment = {};
    if (hasAttachment) {
      await sendTelegramChatAction(chatId, 'typing');
      try {
        attachment = await resolveAttachment(message);
      } catch (err) {
        await sendTelegramMessage(chatId, err.message || "Faylni o'qib bo'lmadi.");
        return Response.json({ ok: true });
      }
      if (attachment.unsupported) {
        await sendTelegramMessage(chatId, attachment.unsupported);
        return Response.json({ ok: true });
      }
    }

    let userText = text;
    if (attachment.docName !== undefined) {
      userText = appendDocumentText(userText, attachment.docName, attachment.docText);
    }
    if (attachment.image && !userText) {
      userText = 'Bu rasmda nima borligini aytib ber.';
    }

    const input = attachment.image
      ? [
          { type: 'text', text: userText },
          { type: 'image', data: attachment.image.data, mime_type: attachment.image.mimeType },
        ]
      : userText;

    const systemInstruction = buildSystemInstruction(profile, profile?.til);

    const sessionRaw = await redis.get(sessionKey(tgUserId));
    const tgSession = sessionRaw ? (typeof sessionRaw === 'string' ? JSON.parse(sessionRaw) : sessionRaw) : {};
    const previousInteractionId = tgSession.lastInteractionId || null;

    const tools = autoToolsForPlan(plan?.id, settings);

    async function openStream(prevId, model = MODEL, withTools = true) {
      return ai.interactions.create({
        model,
        input,
        system_instruction: systemInstruction,
        previous_interaction_id: prevId || undefined,
        stream: true,
        tools: withTools ? tools : undefined,
        generation_config: {
          max_output_tokens: 8192,
          thinking_level: thinkingLevelForPlan(plan?.id),
        },
      });
    }

    // Ochish: eski ip eskirgan bo'lsa usiz, vositalar xato bersa ularsiz,
    // model topilmasa standart model, vaqtinchalik xatoda qayta urinish.
    const stream = await withRetry(
      async (model) => {
        try {
          return await openStream(previousInteractionId, model, true);
        } catch (err) {
          const msg = String(err?.message || err);
          if (previousInteractionId && /interaction|previous|not found|expired|404/i.test(msg)) return openStream(null, model, true);
          if (tools && /tool|google_search|url_context|not supported|400|INVALID_ARGUMENT/i.test(msg)) return openStream(previousInteractionId, model, false);
          throw err;
        }
      },
      { model: MODEL }
    );

    let fullText = '';
    let interactionId = null;
    let lastAction = 0;
    for await (const event of stream) {
      if (event?.interaction?.id) interactionId = event.interaction.id;
      if (event?.event_type === 'step.start' && STEP_STATUS_TEXT[event.step?.type]) {
        // Uzoq qidiruvda "yozmoqda..." belgisi o'chib qolmasin.
        if (Date.now() - lastAction > 4000) {
          lastAction = Date.now();
          sendTelegramChatAction(chatId, 'typing');
        }
      }
      if (event?.event_type === 'step.delta' && event?.delta?.type === 'text') {
        fullText += event.delta.text;
      }
    }

    const { facts, followups, cleanText } = extractHiddenTags(fullText);

    if (Object.keys(facts).length) {
      mergeUserProfile(email, facts).catch((err) => console.error('Profil saqlashda xato:', err));
    }
    if (interactionId) {
      await redis.set(sessionKey(tgUserId), JSON.stringify({ lastInteractionId: interactionId }));
    }

    // Davom-savollar — Telegram'da pastki tugmalar sifatida chiqadi.
    await sendTelegramMessage(chatId, cleanText, { buttons: settings?.features?.followups === false ? [] : followups });
    applyUsage();
    recordEvent({ channel: 'telegram', kind: 'chat', email, ok: true, ms: Date.now() - startedAt, model: MODEL });
  } catch (error) {
    console.error('Telegram chat xatosi:', error);
    recordEvent({ channel: 'telegram', kind: 'chat', email, ok: false, ms: Date.now() - startedAt, model: MODEL, error: error?.message });
    await sendTelegramMessage(chatId, friendlyAiError(error));
  }

  return Response.json({ ok: true });
}

// Telegram webhook manzilini tekshirish uchun (brauzerda ochib ko'rsa, xato bermasin).
export async function GET() {
  return Response.json({ ok: true, message: 'ToshkentGPT Telegram webhook ishlamoqda.' });
}
