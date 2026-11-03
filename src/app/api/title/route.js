import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { DEFAULT_MODEL, withRetry } from '../_lib/ai-generation';

// ============================================================
// Suhbat uchun qisqa nom (2–5 so'z) — birinchi almashinuvdan keyin bir marta
// chaqiriladi. Eng arzon rejim: kichik model, o'ylashsiz, 24 token.
// Limitga kirmaydi (xabar sanalmaydi).
// ============================================================
const TITLE_MODEL = process.env.GEMINI_TITLE_MODEL || process.env.GEMINI_MODEL_LITE || DEFAULT_MODEL;

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ title: null });

  const body = await req.json().catch(() => null);
  const user = String(body?.user || '').slice(0, 1200);
  const assistant = String(body?.assistant || '').slice(0, 1200);
  if (!user) return Response.json({ title: null });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await withRetry(
      (model) =>
        ai.models.generateContent({
          model,
          contents: `Quyidagi suhbat uchun 2-5 so'zdan iborat QISQA sarlavha yoz (suhbat tilida, tirnoqsiz, nuqtasiz, emoji'siz, faqat sarlavhaning o'zi):\n\nFoydalanuvchi: ${user}\n\nYordamchi: ${assistant}`,
          config: { maxOutputTokens: 24, temperature: 0.3, thinkingConfig: { thinkingLevel: 'minimal' } },
        }),
      { model: TITLE_MODEL, retries: 1 }
    );
    let title = (res?.text || res?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '').trim();
    title = title.split('\n')[0].replace(/^["'«»“”]+|["'«»“”.]+$/g, '').trim().slice(0, 60);
    return Response.json({ title: title || null });
  } catch (err) {
    console.error('Sarlavha yaratishda xato:', err?.message || err);
    return Response.json({ title: null });
  }
}
