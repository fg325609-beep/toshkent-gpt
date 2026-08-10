import { GoogleGenAI } from '@google/genai';

// Gemini API kaliti va model nomi FAQAT .env.local fayldan o'qiladi — kodga yozilmaydi,
// shunda GitHub'ga push qilsang ham kaliting ochilib qolmaydi (.env* .gitignore'da).
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const SYSTEM_STYLE = `Sen haqiqiy toshkentlik yigitsan. Isming - ToshkentGPT. Foydalanuvchi bilan 'jigar', 'brat', 'chotki', 'qalay' kabi so'zlarni ishlatib, samimiy va hazil-mutoyiba bilan gaplashasan. Juda rasmiy bo'lma, xuddi yaqin o'rtog'ing bilan choyxonada suhbatlashayotgandek erkin, sodda va qisqa javob ber. Agar rasm yoki fayl yuborilsa, uning mazmuni haqida ham shu uslubda gapirib ber.`;

export async function POST(req) {
  try {
    const { text, image, previousInteractionId } = await req.json();

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

    // Gemini "Interactions API" — rasm bo'lsa multimodal massiv, bo'lmasa oddiy matn.
    const input = image?.data
      ? [
          { type: 'text', text: text || 'Bu rasmda nima borligini aytib ber.' },
          { type: 'image', data: image.data, mime_type: image.mimeType },
        ]
      : text;

    async function callGemini(prevId) {
      return ai.interactions.create({
        model: MODEL,
        input,
        system_instruction: SYSTEM_STYLE,
        previous_interaction_id: prevId || undefined,
      });
    }

    let interaction;
    try {
      // previous_interaction_id orqali suhbat "xotirasi" server tomonda saqlanadi —
      // har safar butun tarixni qayta yubormaymiz.
      interaction = await callGemini(previousInteractionId);
    } catch (err) {
      // Eski/yaroqsiz previous_interaction_id bo'lsa (masalan bir necha kundan keyin),
      // kontekstsiz qayta urinamiz — foydalanuvchi xatoni ko'rmaydi.
      if (previousInteractionId) {
        interaction = await callGemini(null);
      } else {
        throw err;
      }
    }

    return Response.json({
      response: interaction.output_text || 'Javob kelmadi.',
      interactionId: interaction.id,
    });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ response: `Xatolik: ${error.message}` }, { status: 500 });
  }
}
