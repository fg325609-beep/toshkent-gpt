import { GoogleGenAI } from '@google/genai';

// Gemini API kaliti va model nomi FAQAT .env.local fayldan o'qiladi — kodga yozilmaydi,
// shunda GitHub'ga push qilsang ham kaliting ochilib qolmaydi (.env* .gitignore'da).
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const BASE_STYLE = `Sen haqiqiy toshkentlik yigitsan. Isming - ToshkentGPT. Foydalanuvchi bilan 'jigar', 'brat', 'chotki', 'qalay' kabi so'zlarni ishlatib, samimiy va hazil-mutoyiba bilan gaplashasan. Juda rasmiy bo'lma, xuddi yaqin o'rtog'ing bilan choyxonada suhbatlashayotgandek erkin, sodda va qisqa javob ber. Agar rasm yoki fayl yuborilsa, uning mazmuni haqida ham shu uslubda gapirib ber.`;

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

export async function POST(req) {
  try {
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

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const input = image?.data
      ? [
          { type: 'text', text: text || 'Bu rasmda nima borligini aytib ber.' },
          { type: 'image', data: image.data, mime_type: image.mimeType },
        ]
      : text;

    const systemInstruction = buildSystemInstruction(profile);

    async function callGemini(prevId) {
      return ai.interactions.create({
        model: MODEL,
        input,
        system_instruction: systemInstruction,
        previous_interaction_id: prevId || undefined,
      });
    }

    let interaction;
    try {
      interaction = await callGemini(previousInteractionId);
    } catch (err) {
      if (previousInteractionId) {
        interaction = await callGemini(null);
      } else {
        throw err;
      }
    }

    const rawText = interaction.output_text || '';

    // Yashirin [[ESLA: ...]] belgilarini ajratib olib, ko'rinadigan matndan tozalaymiz.
    const facts = {};
    let match;
    FACT_TAG_RE.lastIndex = 0;
    while ((match = FACT_TAG_RE.exec(rawText)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value) facts[key] = value;
    }
    const cleanText = rawText.replace(FACT_TAG_RE, '').trim();

    return Response.json({
      response: cleanText || 'Javob kelmadi.',
      interactionId: interaction.id,
      facts: Object.keys(facts).length ? facts : undefined,
    });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ response: `Xatolik: ${error.message}` }, { status: 500 });
  }
}
