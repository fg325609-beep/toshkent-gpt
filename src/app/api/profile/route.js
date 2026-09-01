import { auth } from '@/auth';
import { getUserProfile, saveUserProfile } from '../_lib/user-profile';
import { touchUser } from '../_lib/admin';
 
// ============================================================
// Foydalanuvchi profilini (ism, familiya, o'rganilgan faktlar) Redis'da
// saqlash/o'qish uchun. Email har doim SERVER TOMONDA, sessiyadan olinadi —
// mijoz (brauzer) boshqa birovning emailini yuborib, uning profilini
// o'qiy/yoza olmasligi uchun.
// ============================================================
 
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({});
 
  // Ilova ochilganda chaqiriladi — shu bilan birga admin panelidagi
  // "online foydalanuvchilar" ro'yxati uchun faollikni belgilab qo'yamiz.
  touchUser(email, { name: session.user.name, image: session.user.image }).catch(() => {});
 
  const profile = await getUserProfile(email);
  return Response.json(profile);
}
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
 
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ error: "Noto'g'ri ma'lumot." }, { status: 400 });
  }
 
  await saveUserProfile(email, body).catch((err) => console.error('Profil saqlashda xato:', err));
  return Response.json({ ok: true });
}
 