import { getRedis } from './redis';
 
// ============================================================
// Push-bildirishnoma obunalarini saqlash. Har bir foydalanuvchi (email
// bo'yicha) bir nechta qurilmadan obuna bo'lishi mumkin (masalan telefon
// va kompyuter) — shuning uchun ro'yxat (SET) sifatida saqlanadi.
// ============================================================
 
const subsKey = (email) => `tg:push-subs:${email}`;
const ALL_EMAILS_KEY = 'tg:push-subscribed-emails';
 
export async function saveSubscription(email, subscription) {
  const redis = getRedis();
  if (!redis || !email || !subscription) return;
  await redis.sadd(subsKey(email), JSON.stringify(subscription));
  await redis.sadd(ALL_EMAILS_KEY, email);
}
 
export async function removeSubscription(email, endpoint) {
  const redis = getRedis();
  if (!redis || !email) return;
  const subs = (await redis.smembers(subsKey(email))) || [];
  for (const raw of subs) {
    const sub = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (sub.endpoint === endpoint) {
      await redis.srem(subsKey(email), raw);
    }
  }
}
 
export async function getUserSubscriptions(email) {
  const redis = getRedis();
  if (!redis || !email) return [];
  const subs = (await redis.smembers(subsKey(email))) || [];
  return subs.map((raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw));
}
 
/** Admin'dan hammaga e'lon yuborish uchun — barcha obuna bo'lgan email'larni qaytaradi. */
export async function getAllSubscribedEmails() {
  const redis = getRedis();
  if (!redis) return [];
  return (await redis.smembers(ALL_EMAILS_KEY)) || [];
}
 
// ============================================================
// Bildirishnomalar TARIXI — push xabari OS darajasida yuborilgach yo'qolib
// ketadi (foydalanuvchi ko'rmasligi ham mumkin). Shu sabab har bir e'lon
// alohida ro'yxatda ham saqlanadi — "Bildirishnomalar" sahifasida hamma
// buni istalgan vaqt qayta ko'ra oladi.
// ============================================================
const HISTORY_KEY = 'tg:notifications:history';
const MAX_HISTORY = 100;
 
export async function saveNotificationHistory(title, message) {
  const redis = getRedis();
  if (!redis) return;
  const entry = JSON.stringify({ title, message, createdAt: new Date().toISOString() });
  await redis.lpush(HISTORY_KEY, entry);
  await redis.ltrim(HISTORY_KEY, 0, MAX_HISTORY - 1);
}
 
export async function getNotificationHistory(limit = 30) {
  const redis = getRedis();
  if (!redis) return [];
  const raw = (await redis.lrange(HISTORY_KEY, 0, limit - 1)) || [];
  return raw.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}
 