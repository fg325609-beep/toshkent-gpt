// Assistant javoblariga qo'yilgan 👍/👎 belgilarni Redis'ga yozib boradi —
// shunda keyinchalik qaysi javoblar yoqmaganini ko'rib, botni yaxshilash
// mumkin. Interfeysni hech qachon to'smasligi kerak, shuning uchun har
// qanday xato jimgina yutiladi (frontend ham .catch(() => {}) bilan
// chaqiradi).
import { auth } from '@/auth';
import { getRedis } from '../_lib/redis';
 
const RATINGS_KEY = 'tg:ratings';
const MAX_RATINGS = 500; // ro'yxat cheksiz o'smasligi uchun
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email || null;
 
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
 
  const rating = body?.rating === 'up' || body?.rating === 'down' ? body.rating : null;
  if (!rating) {
    return Response.json({ ok: false }, { status: 400 });
  }
 
  const redis = getRedis();
  if (redis) {
    try {
      const entry = JSON.stringify({
        rating,
        content: String(body?.content || '').slice(0, 500),
        email,
        time: new Date().toISOString(),
      });
      await redis.lpush(RATINGS_KEY, entry);
      await redis.ltrim(RATINGS_KEY, 0, MAX_RATINGS - 1);
    } catch (err) {
      console.error('Baholashni saqlashda xato:', err);
    }
  }
 
  return Response.json({ ok: true });
}