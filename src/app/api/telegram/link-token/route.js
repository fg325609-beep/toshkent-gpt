import { auth } from '@/auth';
import { getRedis } from '../../_lib/redis';
 
// "Telegram bilan bog'lash" tugmasi bosilganda chaqiriladi. Foydalanuvchining
// email'iga bog'langan, 10 daqiqa amal qiladigan bir martalik token yaratadi.
// Bu token keyin Telegram botga "/start <token>" sifatida yuboriladi.
function randomToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
 
export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Avval tizimga kiring' }, { status: 401 });
  }
 
  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: "Xizmat vaqtincha ishlamayapti (Redis yo'q)" }, { status: 503 });
  }
 
  const token = randomToken();
  try {
    await redis.set(`tg:tglink-token:${token}`, email, { ex: 600 });
  } catch (err) {
    console.error('Link token yaratishda xato:', err);
    return Response.json({ error: 'Xatolik yuz berdi' }, { status: 500 });
  }
 
  const botUsername = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '') || null;
  return Response.json({ token, botUsername });
}
 