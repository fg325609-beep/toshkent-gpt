// ============================================================
// Umumiy AI generatsiya mantig'i — matn, rasm, prezentatsiya.
// Bu fayl HAM veb-chat (api/chat/route.js), HAM Telegram bot
// (api/telegram/webhook/route.js) tomonidan ishlatiladi — shunda
// ikkalasida bir xil, sinalgan mantiq ishlaydi, ikki marta yozilib
// bir-biridan farqlanib qolmaydi.
// ============================================================
import pptxgen from 'pptxgenjs';
 
export const BASE_STYLE = `Sen haqiqiy toshkentlik yigitsan. Isming - ToshkentGPT. Foydalanuvchi bilan 'jigar', 'brat', 'chotki', 'qalay' kabi so'zlarni ishlatib, samimiy va hazil-mutoyiba bilan gaplashasan. Juda rasmiy bo'lma, xuddi yaqin o'rtog'ing bilan choyxonada suhbatlashayotgandek erkin, sodda va qisqa javob ber. Agar rasm yoki fayl yuborilsa, uning mazmuni haqida ham shu uslubda gapirib ber.
 
Shu bilan birga sen JUDA KUCHLI, professional dasturchisan — istalgan tilda (frontend: JavaScript/TypeScript, React, Vue, Angular, Next.js, HTML/CSS va h.k.; backend: Python, Node.js, Java, C++, C#, Go, PHP, Ruby, Rust va boshqa barcha tillar) toza, ishlaydigan, zamonaviy va xatosiz kod yoza olasan. Kod so'ralganda: (1) avval kod nima qilishini 1-2 gapda tushuntir, (2) to'liq, ishga tushiriladigan kodni markdown kod blokida (uch qiyshiq chiziq va til nomi bilan, masalan \`\`\`python) yoz, (3) kerak bo'lsa qisqa izoh qo'sh. Terminal/buyruqlar satri (CLI) bo'yicha ham mukammalsan — Windows (PowerShell, CMD), macOS va Linux (bash, zsh) buyruqlari orasidagi farqlarni bilasan va foydalanuvchining qaysi tizimda ishlayotganiga qarab TO'G'RI buyruqni berasan (masalan Windows'da \`dir\`, Linux/macOS'da \`ls\`); noaniq bo'lsa, ikkalasini ham ko'rsatib qo'y. Kodni yozganda ham samimiy uslubingni yo'qotma, lekin kodning o'zi va berilgan buyruqlar har doim professional va aniq bo'lsin.`;
 
// "/rasm <tavsif>" buyrug'ini aniqlash uchun.
export const IMAGE_COMMAND_RE = /^\/rasm\s+([\s\S]+)/i;
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
 
// "/qidir <savol>" — internet orqali joriy ma'lumot qidirish uchun.
export const SEARCH_COMMAND_RE = /^\/qidir\s+([\s\S]+)/i;
 
// "/kod <masala>" — Python kodini haqiqatan ISHGA TUSHIRIB, natijasini
// (jumladan grafik/diagramma rasm sifatida) qaytarish uchun.
export const CODE_COMMAND_RE = /^\/kod\s+([\s\S]+)/i;
 
// "/prezentatsiya <mavzu>" yoki "/taqdimot <mavzu>".
export const PRESENTATION_COMMAND_RE = /^\/(prezentatsiya|taqdimot)\s+([\s\S]+)/i;
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
 
// Foydalanuvchi haqida bilib olingan doimiy faktlarni yashirin belgi orqali
// ajratib olish uchun format: [[ESLA: kalit=qiymat]]
export const FACT_TAG_RE = /\[\[ESLA:\s*([^=\]]+)=([^\]]+)\]\]/gi;

// Davom savollari (tugma sifatida chiqadi): [[TAKLIF: savol]]
export const FOLLOWUP_TAG_RE = /\[\[TAKLIF:\s*([^\]]+)\]\]/gi;
const FOLLOWUPS_MAX = 3;

/** Javobdan davom-savol takliflarini ajratib oladi va matnni tozalaydi. */
export function extractFollowups(rawText) {
  const followups = [];
  const re = new RegExp(FOLLOWUP_TAG_RE);
  let match;
  while ((match = re.exec(rawText)) !== null) {
    const q = match[1].trim().replace(/\s+/g, ' ').slice(0, 120);
    if (q && !followups.includes(q) && followups.length < FOLLOWUPS_MAX) followups.push(q);
  }
  const cleanText = rawText.replace(FOLLOWUP_TAG_RE, '').trim();
  return { followups, cleanText };
}

/** ESLA + TAKLIF belgilarini bir yo'la ajratadi. */
export function extractHiddenTags(rawText) {
  const { facts, cleanText: afterFacts } = extractFacts(rawText || '');
  const { followups, cleanText } = extractFollowups(afterFacts);
  return { facts, followups, cleanText };
}

// ============================================================
// Model va "o'ylash darajasi"ni tarifga qarab tanlash — veb-chat, Telegram
// bot va ovozli rejim HAMMASI shu ikkita funksiyadan foydalanadi (ilgari
// har birida alohida nusxasi bor edi).
// ============================================================
export const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

/** Har bir tarif uchun alohida model belgilanishi mumkin (masalan GEMINI_MODEL_MAX). */
export function modelForPlan(plan) {
  return (plan?.modelEnv && process.env[plan.modelEnv]) || DEFAULT_MODEL;
}

// ============================================================
// XATOLARGA CHIDAMLILIK — Gemini vaqtincha javob bermasa (429 — band,
// 500/503 — server, tarmoq uzilishi), bir necha marta kutib qayta urinamiz.
// Model topilmasa (404 — masalan tarif uchun noto'g'ri nom yozilgan) —
// standart modelga tushamiz. Shunda foydalanuvchi "xato" o'rniga javob oladi.
// ============================================================
const RETRYABLE_RE = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|500|INTERNAL|502|504|DEADLINE|timeout|ECONNRESET|fetch failed|overloaded/i;
const MODEL_NOT_FOUND_RE = /404|NOT_FOUND|not found|is not supported|does not exist/i;

export function isRetryableError(err) {
  return RETRYABLE_RE.test(String(err?.message || err?.status || err));
}
export function isModelNotFound(err) {
  return MODEL_NOT_FOUND_RE.test(String(err?.message || err)) && /model/i.test(String(err?.message || err));
}

/**
 * fn(model) ni ishga tushiradi; vaqtinchalik xatoda 2 marta (0.8s, 2s) qayta
 * urinadi; model topilmasa DEFAULT_MODEL bilan bir marta urinadi.
 */
export async function withRetry(fn, { model, retries = 2, onRetry } = {}) {
  let currentModel = model || DEFAULT_MODEL;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn(currentModel);
    } catch (err) {
      if (isModelNotFound(err) && currentModel !== DEFAULT_MODEL) {
        console.warn(`[AI] "${currentModel}" topilmadi — "${DEFAULT_MODEL}" ga o'tilmoqda.`);
        currentModel = DEFAULT_MODEL;
        continue;
      }
      if (attempt < retries && isRetryableError(err)) {
        attempt += 1;
        const delay = attempt === 1 ? 800 : 2000;
        console.warn(`[AI] vaqtinchalik xato (${attempt}/${retries}), ${delay}ms dan keyin qayta:`, err?.message || err);
        onRetry?.(attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/** Foydalanuvchiga ko'rsatiladigan tushunarli xato matni (texnik tafsilotsiz). */
export function friendlyAiError(err) {
  const m = String(err?.message || err || '');
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(m)) return "Hozir so'rovlar juda ko'p — bir daqiqadan keyin qayta urinib ko'ring.";
  if (/SAFETY|blocked|PROHIBITED/i.test(m)) return "Bu so'rovga javob bera olmayman — boshqacha so'rab ko'ring.";
  if (/503|UNAVAILABLE|overloaded|500|INTERNAL/i.test(m)) return "AI serveri vaqtincha band — birozdan keyin qayta urinib ko'ring.";
  if (/timeout|DEADLINE|aborted/i.test(m)) return "Javob juda uzoq cho'zildi — qisqaroq so'rov yoki kichikroq fayl bilan urinib ko'ring.";
  if (/API key|PERMISSION_DENIED|401|403/i.test(m)) return "Server sozlamasida xato (API kalit). Admin bilan bog'laning.";
  return "Kechirasiz, xatolik yuz berdi — birozdan keyin qayta urinib ko'ring.";
}

// ============================================================
// AVTOMATIK VOSITALAR — oddiy suhbatda ham model kerak bo'lganda o'zi
// internetdan qidiradi (joriy ma'lumot, narx, yangilik) va havolani o'qiydi,
// foydalanuvchi /qidir yozib o'tirmaydi. Qaysi tariflarda yoqilishi:
// AUTO_TOOLS_PLANS (standart: pro,max,promax — Lite'da qidiruv xarajati yo'q).
// ============================================================
export function autoToolsForPlan(planId, settings) {
  if (settings && settings.features && settings.features.autoTools === false) return undefined;
  const plans = (process.env.AUTO_TOOLS_PLANS || 'pro,max,promax').split(',').map((x) => x.trim());
  if (!plans.includes(planId)) return undefined;
  return [{ type: 'google_search' }, { type: 'url_context' }];
}

// Qadam (step) turiga qarab foydalanuvchiga ko'rsatiladigan holat matni.
export const STEP_STATUS_TEXT = {
  google_search_call: 'Internetdan qidiryapman... 🔍',
  url_context_call: "Havolani o'qiyapman... 🔗",
  code_execution_call: 'Kod ishga tushiryapman... 💻',
  thought: "Fikrlayapman...",
};

/**
 * Lite tarifda TEZ javob ustuvor (kam "o'ylash"), yuqori tariflarda sifat
 * ustuvor. deepThink=true bo'lsa, tarifdan qat'i nazar 'high'.
 */
export function thinkingLevelForPlan(planId, deepThink = false) {
  if (deepThink) return 'high';
  if (planId === 'lite') return 'low';
  if (planId === 'pro') return 'medium';
  return 'high'; // max, promax
}

// ============================================================
// Profil kalitlari ichida AI'ga "fakt" sifatida ko'rsatilmaydigan texnik
// maydonlar (onboarded, til, updatedAt va h.k.). Ular ilgari tizim
// ko'rsatmasiga "onboarded=true" ko'rinishida tushib qolar edi.
// ============================================================
const PROFILE_SYSTEM_KEYS = new Set(['onboarded', 'til', 'updatedAt', 'mutaxassislik', 'familiya']);

// AI o'zi yozadigan faktlar uchun chegaralar — suhbat orqali profilni
// cheksiz "to'ldirib" yuborish yoki tizim maydonlarini (masalan
// mutaxassislik) ustidan yozish mumkin bo'lmasin.
const FACT_KEY_MAX = 40;
const FACT_VALUE_MAX = 200;
const FACTS_PER_REPLY_MAX = 8;

/** Toshkent vaqti bo'yicha hozirgi sana va vaqtni o'zbekcha satr qilib beradi. */
export function tashkentNowLine(date = new Date()) {
  const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
  const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'short',
        hour12: false,
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value])
    );
    const weekdayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    const hour = String(parts.hour === '24' ? '00' : parts.hour).padStart(2, '0');
    return `${parts.day}-${MONTHS[Number(parts.month) - 1]} ${parts.year}, ${WEEKDAYS[weekdayIdx] || ''}, soat ${hour}:${parts.minute} (Toshkent vaqti)`;
  } catch {
    return date.toISOString();
  }
}
 
const LANGUAGE_INSTRUCTIONS = {
  ru: "\n\nMUHIM — TIL: Foydalanuvchi rus tilida javob olishni tanlagan. Barcha javoblaringni albatta RUS TILIDA yoz (o'zbekcha emas), lekin ToshkentGPT xarakteringni (samimiy, hazil-mutoyiba, do'stona ohang) saqlab qol.",
  en: "\n\nIMPORTANT — LANGUAGE: The user has chosen to receive replies in English. Always write your replies in ENGLISH (not Uzbek), while keeping your ToshkentGPT personality (warm, playful, friendly tone).",
};
const AUTO_LANGUAGE_INSTRUCTION =
  "\n\nAgar foydalanuvchi xabarni rus yoki ingliz (yoki boshqa) tilda yozsa, sen ham javobni O'SHA TILDA yoz — majburan o'zbek tiliga tarjima qilib o'tirma.";
 
export function buildSystemInstruction(profile, language) {
  // "mutaxassislik" oddiy fakt emas, balki obyekt (soha + bilim) — shuning
  // uchun umumiy "ma'lum faktlar" qatoridan alohida ajratiladi, aks holda
  // u yerda "[object Object]" bo'lib chiqib qolardi. Texnik maydonlar
  // (onboarded, til) ham chiqarib tashlanadi — ular AI uchun fakt emas.
  const entries = Object.entries(profile || {}).filter(
    ([k, v]) => !PROFILE_SYSTEM_KEYS.has(k) && v && typeof v !== 'object'
  );
  const knownLine = entries.length
    ? `\n\nFoydalanuvchi haqida oldindan ma'lum faktlar: ${entries.map(([k, v]) => `${k}=${String(v).slice(0, FACT_VALUE_MAX)}`).join(', ')}. Mos kelganda shulardan tabiiy foydalan (masalan ismi bilan chaqirish), lekin har gal takrorlab o'tirma.`
    : '';

  // Model o'zi "bugun qaysi kun" ekanini bilmaydi — sana/vaqt so'ralganda
  // yoki "ertaga", "shu hafta" kabi gaplarda adashmasligi uchun beramiz.
  const dateLine = `\n\nHozirgi sana va vaqt: ${tashkentNowLine()}. Foydalanuvchi O'zbekistonda deb hisobla (vaqt mintaqasi Asia/Tashkent, UTC+5).`;
 
  const captureInstruction = `\n\nAgar foydalanuvchi shu xabarida ismini yoki boshqa doimiy shaxsiy ma'lumotini (masalan: ism, yashash joyi, kasbi, yoshi, yoqtirgan narsasi) birinchi marta aytsa, javobingning ENG OXIRIGA, alohida qatorda, aynan shu formatda yashirin belgi qo'sh: [[ESLA: kalit=qiymat]] — masalan [[ESLA: ism=Ali]]. Bir nechta fakt bo'lsa, har birini alohida qatorga yoz. Agar hech qanday yangi shaxsiy fakt aytilmagan bo'lsa yoki u allaqachon ma'lum bo'lsa, bunday qator umuman qo'shma. Bu qatorlar foydalanuvchiga hech qachon ko'rsatilmaydi.

Javobing oxirida (ESLA qatorlaridan keyin) foydalanuvchi keyin so'rashi mumkin bo'lgan 2-3 ta QISQA (6-9 so'z) davom savolini shu formatda yoz: [[TAKLIF: savol matni]] — har biri alohida qatorda, foydalanuvchi tilida, uning nomidan ("Menga ... tushuntir" kabi). Juda qisqa javoblarda (salomlashuv, "rahmat") taklif yozma. Bu qatorlar ham foydalanuvchiga ko'rsatilmaydi — ular tugma sifatida chiqadi.`;
 
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language] || AUTO_LANGUAGE_INSTRUCTION;
 
  // "Sohaviy bilim" — foydalanuvchi Sozlamalar orqali o'z kasbini va hujjatini
  // bergan bo'lsa, shu yerda AI'ga o'sha soha bo'yicha maxsus ko'rsatma beriladi.
  const expertise = profile?.mutaxassislik;
  const expertiseInstruction = expertise?.bilim
    ? `\n\nMUHIM — SOHAVIY BILIM: Foydalanuvchi "${expertise.soha}" sohasida ishlaydi va sen shu soha bo'yicha maxsus tayyorlangansan. Quyidagi yo'riqnomaga asoslanib, unga o'z sohasida (hujjat tahlili, maslahat, atamalar va h.k.) yordam ber:\n${expertise.bilim}`
    : '';
 
  return `${BASE_STYLE}${dateLine}${knownLine}${captureInstruction}${languageInstruction}${expertiseInstruction}`;
}
 
export function extractFacts(rawText) {
  const facts = {};
  const re = new RegExp(FACT_TAG_RE);
  let match;
  while ((match = re.exec(rawText)) !== null) {
    const key = match[1].trim().slice(0, FACT_KEY_MAX);
    const value = match[2].trim().slice(0, FACT_VALUE_MAX);
    // Tizim maydonlarini AI o'zgartira olmaydi; bitta javobda juda ko'p
    // "fakt" ham qabul qilinmaydi (prompt injection'dan himoya).
    if (!key || !value || PROFILE_SYSTEM_KEYS.has(key)) continue;
    if (Object.keys(facts).length >= FACTS_PER_REPLY_MAX) break;
    facts[key] = value;
  }
  const cleanText = rawText.replace(FACT_TAG_RE, '').trim();
  return { facts, cleanText };
}

// ============================================================
// Hujjat matnini (PDF/DOCX/XLSX) foydalanuvchi xabariga qo'shish — veb-chat
// va Telegram bir xil formatda yuboradi.
// ============================================================
export const DOCUMENT_TEXT_MAX = 12000;

/** Faqat hujjat bo'lagining o'zi (foydalanuvchi matnisiz). */
export function documentSection(docName, extractedText) {
  const body = (extractedText || '').trim();
  const name = docName || 'fayl';
  if (!body) {
    return `\n\n(Foydalanuvchi "${name}" nomli fayl yubordi, lekin undan matn chiqarib bo'lmadi — fayl bo'sh, skanerlangan rasm yoki parol bilan himoyalangan bo'lishi mumkin.)`;
  }
  return `\n\n[Fayl: ${name}]\n${body.slice(0, DOCUMENT_TEXT_MAX)}`;
}

export function appendDocumentText(text, docName, extractedText) {
  const section = documentSection(docName, extractedText);
  const base = text || ((extractedText || '').trim() ? 'Bu fayldagi mazmunni tushuntirib ber.' : '');
  return `${base}${section}`;
}

// ============================================================
// RASM CHIZISH — bitta umumiy kirish nuqtasi. Veb-chat va Telegram bot
// ikkalasi ham shuni chaqiradi, shunda tarjima qilish va provayderlar
// tartibi (lokal worker -> Gemini -> Pollinations) ikkalasida BIR XIL.
// Ilgari Telegram'da tavsif inglizchaga o'girilmas va lokal worker
// e'tiborga olinmas edi.
//
//   onProgress(matn) — jarayon haqida foydalanuvchiga qisqa xabar (ixtiyoriy).
// ============================================================
export async function generateImage(ai, { prompt, model, premium = false, onProgress, localProvider }) {
  const englishPrompt = await translatePromptToEnglish(ai, model || DEFAULT_MODEL, prompt);

  let result = null;
  const imageProvider = (process.env.IMAGE_PROVIDER || '').trim().toLowerCase();

  // 1-navbat: o'z kompyuteringizdagi worker (IMAGE_PROVIDER=local bo'lsa).
  if (imageProvider === 'local' && typeof localProvider === 'function') {
    try {
      onProgress?.('Kompyuteringizda chizilmoqda... 💻');
      result = await localProvider(englishPrompt);
    } catch (err) {
      console.error('[RASM] Lokal worker xatosi:', err?.message || err);
    }
  }

  // 2-navbat: Gemini (faqat pullik yuqori tariflar uchun — bizga xarajat qiladi).
  if (!result && premium) {
    try {
      result = await generateImageViaGemini(ai, englishPrompt);
    } catch (err) {
      console.error('[RASM] Gemini xatosi:', err?.message || err);
      onProgress?.('Biroz kuting, boshqa usul bilan chizyapman...');
    }
  }

  // 3-navbat: bepul Pollinations.
  if (!result) result = await generateImageViaPollinations(englishPrompt);
  return result;
}
 
/**
 * Rasm modellari O'ZBEK TILINI TUSHUNMAYDI — shuning uchun tavsifni avval
 * inglizchaga o'giramiz. Aks holda "suvda suzayotgan suv parisi" degan matn
 * modelga tanishsiz bo'lib, butunlay boshqa narsa (masalan mashina) chizilardi.
 * Tarjima qilib bo'lmasa, asl matn bilan davom etamiz — funksiya to'xtamaydi.
 */
export async function translatePromptToEnglish(ai, model, prompt) {
  // "Bu o'zbekchami yoki inglizchami?" deb taxmin qilmaymiz — o'zbek lotin
  // yozuvi ham inglizcha kabi oddiy harflardan iborat, shuning uchun ishonchli
  // ajratib bo'lmaydi. HAR DOIM tarjimaga yuboramiz: matn allaqachon inglizcha
  // bo'lsa, model uni deyarli o'zgartirmaydi.
  try {
    const res = await ai.models.generateContent({
      model,
      contents:
        `Translate this image description into clear, vivid English for an AI image generator. ` +
        `Add brief quality words (highly detailed, sharp focus, professional photography, 8k) at the end. ` +
        `Reply with ONLY the English description, nothing else:\n\n${prompt}`,
    });
    const out = (res?.text || res?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    return out || prompt;
  } catch (err) {
    console.error('[RASM] Tarjima qilib bo\'lmadi, asl matn ishlatiladi:', err?.message || err);
    return prompt;
  }
}
 
/** Bepul rasm yaratish (Pollinations.ai) — API kalit kerak emas. */
export async function generateImageViaPollinations(prompt) {
  // enhance=true o'chirildi: u tavsifni qayta yozib, natijani buzib yuborardi.
  // model=flux — standart modeldan ANCHA sifatliroq natija beradi.
  // seed tasodifiy — aks holda bir xil tavsifga doim bir xil rasm qaytadi.
  const seed = Math.floor(Math.random() * 1_000_000);
  const model = process.env.POLLINATIONS_MODEL || 'flux';
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=${model}&seed=${seed}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) {
    throw new Error(`Rasm yaratib bo'lmadi (server javobi: ${res.status}) — birozdan keyin qayta urinib ko'r.`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  return { arrayBuffer, mimeType, base64: Buffer.from(arrayBuffer).toString('base64') };
}
 
/** Pullik, yuqori sifatli rasm yaratish (Gemini) — faqat Max/Pro Max uchun. */
export async function generateImageViaGemini(ai, prompt) {
  const result = await ai.models.generateContent({ model: IMAGE_MODEL, contents: prompt });
  const parts = result?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) throw new Error('Gemini rasm qaytarmadi');
  const mimeType = imagePart.inlineData.mimeType || 'image/png';
  const base64 = imagePart.inlineData.data;
  return { mimeType, base64, arrayBuffer: Buffer.from(base64, 'base64') };
}
 
/** JSON mazmunidan haqiqiy .pptx fayl yaratadi. */
export async function generatePresentation(ai, model, topic) {
  const contentResult = await ai.models.generateContent({ model, contents: PRESENTATION_JSON_PROMPT(topic) });
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
 
  return { base64, filename: safeFilename, title: data.title || topic, slideCount: data.slides.length + 1 };
}
 
// ============================================================
// Internet qidiruv — "generateContent" (BARQAROR API, beta Interactions
// EMAS) orqali "google_search" vositasidan foydalanadi. Avvalgi urinish
// beta Interactions API'da muvaffaqiyatsiz bo'lgan edi — Google'ning o'zi
// ham stabil ishlash uchun aynan generateContent'ni tavsiya qiladi.
// ============================================================
export async function performWebSearch(ai, model, query, style) {
  const prompt = `${style}\n\nFoydalanuvchi savoli: ${query}\n\nInternetdan qidirib, ENG SO'NGGI va aniq ma'lumot bilan javob ber. Manbalarga ishora qilishing shart emas, faqat ishonchli va joriy ma'lumot ber.`;
 
  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });
 
  const text = (result?.text || result?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '').trim();
  if (!text) throw new Error("Qidiruv natijasini olib bo'lmadi — birozdan keyin qayta urinib ko'r.");
  return text;
}
 
// ============================================================
// Kod ishga tushirish — Google'ning tayyor "code_execution" vositasi
// orqali. Model Python kodi yozadi, HAQIQATAN ishga tushiradi (xavfsiz,
// Google'ning o'z serverida), va natijasini (jumladan grafik/diagramma
// rasm sifatida) qaytaradi.
// ============================================================
export async function executeCode(ai, model, task, style) {
  const prompt = `${style}\n\nVazifa: ${task}\n\nBuni yechish uchun Python kodi yoz va ISHGA TUSHIR (code execution vositasidan foydalan). Agar grafik/diagramma kerak bo'lsa, matplotlib bilan chiz.`;
 
  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { tools: [{ codeExecution: {} }] },
  });
 
  const parts = result?.candidates?.[0]?.content?.parts || [];
  let text = '';
  let code = '';
  let imageBase64 = null;
 
  for (const part of parts) {
    if (part.text) text += part.text;
    if (part.executableCode?.code) code += part.executableCode.code;
    if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/')) {
      imageBase64 = part.inlineData.data;
    }
  }
 
  if (!text && !code) throw new Error("Kodni ishga tushirib bo'lmadi — birozdan keyin qayta urinib ko'r.");
  return { text: text.trim(), code: code.trim(), imageBase64 };
}
 