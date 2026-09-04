import { getRedis } from './redis';
 
// ============================================================
// Admin tekshiruvi: ENDI FAQAT bitta ADMIN_EMAIL emas — asosiy admin
// (.env.local'dagi ADMIN_EMAIL) doim ishlaydi, UNGA QO'SHIMCHA ravishda
// Redis'dagi "tg:admin-emails" ro'yxatiga qo'shilgan boshqa odamlar ham
// admin bo'la oladi. Shunda Redis vaqtincha ishlamay qolsa ham, asosiy
// admin har doim kira oladi.
// ============================================================
const PRIMARY_ADMIN = (process.env.ADMIN_EMAIL || '').toLowerCase();
 
export async function isAdminEmail(email) {
  if (!email) return false;
  const normalized = email.toLowerCase();
  if (normalized === PRIMARY_ADMIN) return true;
 
  const redis = getRedis();
  if (!redis) return false;
  try {
    return !!(await redis.sismember('tg:admin-emails', normalized));
  } catch (err) {
    console.error('Admin ro\'yxatini tekshirishda xato:', err);
    return false;
  }
}
 
export async function listExtraAdmins() {
  const redis = getRedis();
  if (!redis) return [];
  try {
    return (await redis.smembers('tg:admin-emails')) || [];
  } catch (err) {
    console.error('Admin ro\'yxatini o\'qishda xato:', err);
    return [];
  }
}
 
export async function addAdminEmail(email) {
  const redis = getRedis();
  if (!redis || !email) return;
  await redis.sadd('tg:admin-emails', email.toLowerCase());
}
 
// ============================================================
// Foydalanuvchi faolligini kuzatish — "kimlar bor, kim onlayn" uchun.
// Har bir muhim so'rovda (chat yozganda, ilova ochilganda) chaqiriladi.
// Redis'da bitta HASH ichida (tg:users:index) har bir email uchun
// {name, image, firstSeen, lastSeen} saqlanadi — shunda ro'yxatni bir
// so'rovda (HGETALL) to'liq olish mumkin.
// ============================================================
const USERS_INDEX_KEY = 'tg:users:index';
export const ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 daqiqa ichida faollik bo'lsa "onlayn"
 
export async function touchUser(email, extra = {}) {
  const redis = getRedis();
  if (!redis || !email) return;
 
  try {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const existingRaw = await redis.hget(USERS_INDEX_KEY, email);
    const existing = existingRaw ? (typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw) : null;
    const isNew = !existing;
 
    const next = {
      name: extra.name || existing?.name || '',
      image: extra.image || existing?.image || '',
      firstSeen: existing?.firstSeen || now,
      lastSeen: now,
    };
    await redis.hset(USERS_INDEX_KEY, { [email]: JSON.stringify(next) });
 
    // Admin statistika grafigi uchun: bugun faol bo'lganlar (SET — bir xil
    // odam bir necha marta yozsa ham bir marta hisoblanadi) va bugun
    // birinchi marta kelganlar soni.
    await redis.sadd(`tg:stats:active:${today}`, email);
    if (isNew) {
      await redis.incr(`tg:stats:new:${today}`);
    }
  } catch (err) {
    // Faollikni belgilay olmasak ham, asosiy funksiya (chat) ishlashda davom etishi kerak.
    console.error('Foydalanuvchi faolligini yozishda xato:', err);
  }
}
 
/** Oxirgi N kun uchun kunlik "faol foydalanuvchi" va "yangi ro'yxatdan o'tgan" sonlarini qaytaradi. */
export async function getDailyStats(days = 14) {
  const redis = getRedis();
  if (!redis) return [];
 
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    try {
      const [active, newCount] = await Promise.all([
        redis.scard(`tg:stats:active:${dateStr}`),
        redis.get(`tg:stats:new:${dateStr}`),
      ]);
      result.push({ date: dateStr, active: active || 0, newUsers: Number(newCount) || 0 });
    } catch (err) {
      console.error("Statistikani o'qishda xato:", err);
      result.push({ date: dateStr, active: 0, newUsers: 0 });
    }
  }
  return result;
}
 
export async function listTrackedUsers() {
  const redis = getRedis();
  if (!redis) return [];
 
  try {
    const all = (await redis.hgetall(USERS_INDEX_KEY)) || {};
    const now = Date.now();
 
    return Object.entries(all).map(([email, raw]) => {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const lastSeenMs = data?.lastSeen ? new Date(data.lastSeen).getTime() : 0;
      return {
        email,
        name: data?.name || '',
        image: data?.image || '',
        firstSeen: data?.firstSeen || null,
        lastSeen: data?.lastSeen || null,
        online: now - lastSeenMs < ONLINE_THRESHOLD_MS,
      };
    });
  } catch (err) {
    console.error('Foydalanuvchilar ro\'yxatini o\'qishda xato:', err);
    return [];
  }
}
 