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
 
const LANGUAGE_INSTRUCTIONS = {
  ru: "\n\nMUHIM — TIL: Foydalanuvchi rus tilida javob olishni tanlagan. Barcha javoblaringni albatta RUS TILIDA yoz (o'zbekcha emas), lekin ToshkentGPT xarakteringni (samimiy, hazil-mutoyiba, do'stona ohang) saqlab qol.",
  en: "\n\nIMPORTANT — LANGUAGE: The user has chosen to receive replies in English. Always write your replies in ENGLISH (not Uzbek), while keeping your ToshkentGPT personality (warm, playful, friendly tone).",
};
const AUTO_LANGUAGE_INSTRUCTION =
  "\n\nAgar foydalanuvchi xabarni rus yoki ingliz (yoki boshqa) tilda yozsa, sen ham javobni O'SHA TILDA yoz — majburan o'zbek tiliga tarjima qilib o'tirma.";
 
export function buildSystemInstruction(profile, language) {
  // "mutaxassislik" oddiy fakt emas, balki obyekt (soha + bilim) — shuning
  // uchun umumiy "ma'lum faktlar" qatoridan alohida ajratiladi, aks holda
  // u yerda "[object Object]" bo'lib chiqib qolardi.
  const entries = Object.entries(profile || {}).filter(([k, v]) => k !== 'mutaxassislik' && v);
  const knownLine = entries.length
    ? `\n\nFoydalanuvchi haqida oldindan ma'lum faktlar: ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}. Mos kelganda shulardan tabiiy foydalan (masalan ismi bilan chaqirish), lekin har gal takrorlab o'tirma.`
    : '';
 
  const captureInstruction = `\n\nAgar foydalanuvchi shu xabarida ismini yoki boshqa doimiy shaxsiy ma'lumotini (masalan: ism, yashash joyi, kasbi, yoshi, yoqtirgan narsasi) birinchi marta aytsa, javobingning ENG OXIRIGA, alohida qatorda, aynan shu formatda yashirin belgi qo'sh: [[ESLA: kalit=qiymat]] — masalan [[ESLA: ism=Ali]]. Bir nechta fakt bo'lsa, har birini alohida qatorga yoz. Agar hech qanday yangi shaxsiy fakt aytilmagan bo'lsa yoki u allaqachon ma'lum bo'lsa, bunday qator umuman qo'shma. Bu qatorlar foydalanuvchiga hech qachon ko'rsatilmaydi.`;
 
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language] || AUTO_LANGUAGE_INSTRUCTION;
 
  // "Sohaviy bilim" — foydalanuvchi Sozlamalar orqali o'z kasbini va hujjatini
  // bergan bo'lsa, shu yerda AI'ga o'sha soha bo'yicha maxsus ko'rsatma beriladi.
  const expertise = profile?.mutaxassislik;
  const expertiseInstruction = expertise?.bilim
    ? `\n\nMUHIM — SOHAVIY BILIM: Foydalanuvchi "${expertise.soha}" sohasida ishlaydi va sen shu soha bo'yicha maxsus tayyorlangansan. Quyidagi yo'riqnomaga asoslanib, unga o'z sohasida (hujjat tahlili, maslahat, atamalar va h.k.) yordam ber:\n${expertise.bilim}`
    : '';
 
  return `${BASE_STYLE}${knownLine}${captureInstruction}${languageInstruction}${expertiseInstruction}`;
}
 
export function extractFacts(rawText) {
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
 
/** Bepul rasm yaratish (Pollinations.ai) — API kalit kerak emas. */
export async function generateImageViaPollinations(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&enhance=true`;
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
 