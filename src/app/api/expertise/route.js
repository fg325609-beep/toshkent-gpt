import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { getUserProfile } from '../_lib/user-profile';
import { extractDocumentText } from '../_lib/document-extract';
import { teachExpertise, clearExpertise } from '../_lib/expertise';
 
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
 
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
 
  const profile = await getUserProfile(email).catch(() => ({}));
  return Response.json({ mutaxassislik: profile?.mutaxassislik || null });
}
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
  if (!API_KEY) {
    return Response.json({ error: 'Server sozlanmagan.' }, { status: 500 });
  }
 
  const body = await req.json().catch(() => null);
  const field = (body?.field || '').trim();
  const file = body?.file;
 
  if (!field) {
    return Response.json({ error: 'Soha nomini kiriting (masalan: Stomatologiya).' }, { status: 400 });
  }
  if (field.length > 100) {
    return Response.json({ error: "Soha nomi juda uzun." }, { status: 400 });
  }
 
  let documentText = '';
  if (file?.data) {
    try {
      documentText = await extractDocumentText(file.data, file.name);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 400 });
    }
  }
 
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const mutaxassislik = await teachExpertise(ai, DEFAULT_MODEL, email, field, documentText);
    return Response.json({ ok: true, mutaxassislik });
  } catch (err) {
    console.error("Mutaxassislik o'rgatishda xato:", err);
    return Response.json({ error: err.message || 'Xatolik yuz berdi.' }, { status: 500 });
  }
}
 
export async function DELETE() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
 
  await clearExpertise(email).catch((err) => console.error('Mutaxassislikni tozalashda xato:', err));
  return Response.json({ ok: true });
}
 