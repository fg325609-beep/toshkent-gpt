import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
 
// ============================================================
// Ovozni matnga o'girish (STT). Brauzerning o'z tizimi (Web Speech API)
// har xil qurilma/brauzerda har xil sifat beradi va ba'zilarida umuman
// ishlamaydi (masalan Firefox) — shu sabab Gemini'ning audio tushunish
// qobiliyatidan foydalaniladi: BARCHA qurilmalarda bir xil, barqaror sifat.
// ============================================================
 
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
 
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
  if (!API_KEY) {
    return Response.json({ error: 'Server sozlanmagan.' }, { status: 500 });
  }
 
  const body = await req.json().catch(() => null);
  const audioBase64 = body?.audio;
  const mimeType = body?.mimeType || 'audio/webm';
 
  if (!audioBase64) {
    return Response.json({ error: 'Audio topilmadi.' }, { status: 400 });
  }
 
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const result = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: "Quyidagi audioda aytilgan gapni ANIQ, so'zma-so'z matnga o'gir. Faqat aytilgan matnning o'zini yoz — hech qanday izoh, sarlavha, tirnoq belgisi yoki qo'shimcha so'z qo'shma. Agar audio bo'sh yoki tushunarsiz bo'lsa, hech narsa yozmasdan bo'sh javob qaytar.",
            },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        },
      ],
    });
 
    const text = (result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    return Response.json({ text });
  } catch (err) {
    console.error('STT xatosi:', err);
    return Response.json({ error: err.message || "Ovozni matnga o'girishda xatolik." }, { status: 500 });
  }
}
 