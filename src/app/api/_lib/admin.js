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
    const existingRaw = await redis.hget(USERS_INDEX_KEY, email);
    const existing = existingRaw ? (typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw) : null;
 
    const next = {
      name: extra.name || existing?.name || '',
      image: extra.image || existing?.image || '',
      firstSeen: existing?.firstSeen || now,
      lastSeen: now,
    };
    await redis.hset(USERS_INDEX_KEY, { [email]: JSON.stringify(next) });
  } catch (err) {
    // Faollikni belgilay olmasak ham, asosiy funksiya (chat) ishlashda davom etishi kerak.
    console.error('Foydalanuvchi faolligini yozishda xato:', err);
  }
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
 