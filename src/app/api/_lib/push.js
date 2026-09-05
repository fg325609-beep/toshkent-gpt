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
 