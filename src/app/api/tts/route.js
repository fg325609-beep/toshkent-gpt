import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { generateSpeechMp3 } from '../_lib/tts';
 
const API_KEY = process.env.GEMINI_API_KEY;
 
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
  if (!API_KEY) {
    return Response.json({ error: 'Server sozlanmagan.' }, { status: 500 });
  }
 
  const body = await req.json().catch(() => null);
  const text = (body?.text || '').trim();
  if (!text) {
    return Response.json({ error: "Matn kiritilmadi." }, { status: 400 });
  }
  if (text.length > 2000) {
    return Response.json({ error: "Matn juda uzun (2000 belgidan oshmasin)." }, { status: 400 });
  }
 
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const audioBase64 = await generateSpeechMp3(ai, text);
    return Response.json({ audio: audioBase64, mimeType: 'audio/mpeg' });
  } catch (err) {
    console.error('TTS xatosi:', err);
    return Response.json({ error: err.message || 'Ovoz yaratishda xatolik yuz berdi.' }, { status: 500 });
  }
}