import { getRedis } from './redis';
 
// ============================================================
// Foydalanuvchilarni nazorat qilish (moderatsiya) tizimi. Maqsad — haqoratli
// yoki nomaqbul til ishlatgan foydalanuvchilarni ANIQLASH va, agar takror
// bo'lsa, AVTOMATIK bloklash — lekin bitta og'ish uchun darhol emas (soxta
// signal bo'lishi mumkin), balki bir necha marta takrorlansa.
// ============================================================
 
// Eslatma: bu ro'yxat NAMUNAVIY va OSON KENGAYTIRILADIGAN — o'zingiz
// istalgan so'zni qo'shishingiz yoki olib tashlashingiz mumkin. To'liq,
// hamma holatni qamrab oluvchi ro'yxat emas — asosiy, keng tarqalgan
// so'zlarni tutadi.
const BLOCKED_WORDS = [
  'blyad', 'блять', 'бля',
  'suka', 'сука',
  'xuy', 'хуй', 'хуя',
  'pizda', 'пизда',
  'ebat', 'ebal', 'еба',
  'gandon', 'гандон',
  'kurva',
  'jalab',
];
 
const VIOLATION_LIMIT = 3; // shuncha marta og'ishdan keyin avtomatik bloklanadi
 
function violationKey(email) {
  return `tg:moderation:violations:${email}`;
}
function blockedKey(email) {
  return `tg:moderation:blocked:${email}`;
}
 
/** Matnda taqiqlangan so'z bor-yo'qligini tekshiradi (so'z chegarasi bilan, harf katta-kichikligi muhim emas). */
export function containsProfanity(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((word) => {
    // Kirill/lotin, o'zbek harflari uchun oddiy "so'z ichida bormi" tekshiruvi —
    // to'liq so'z chegarasi tekshiruvi util alifbolar aralashganda ishonchsiz
    // bo'lgani uchun, shunchaki "ichida bormi" ishlatiladi (ozgina qattiqroq,
    // lekin xato o'tkazib yubormaslik muhimroq).
    return lower.includes(word);
  });
}
 
export async function isUserBlocked(email) {
  const redis = getRedis();
  if (!redis || !email) return false;
  const blocked = await redis.get(blockedKey(email));
  return Boolean(blocked);
}
 
export async function blockUser(email) {
  const redis = getRedis();
  if (!redis || !email) return;
  await redis.set(blockedKey(email), '1');
}
 
export async function unblockUser(email) {
  const redis = getRedis();
  if (!redis || !email) return;
  await redis.del(blockedKey(email));
  await redis.del(violationKey(email));
}
 
/**
 * Nomaqbul til ishlatilganini qayd qiladi. Agar OG'ISHLAR SONI chegaraga
 * yetsa, foydalanuvchini AVTOMATIK bloklaydi va shu haqda qaytaradi
 * (chaqiruvchi tomon buni admin'ga Telegram orqali xabar qilishi uchun).
 */
export async function recordViolation(email) {
  const redis = getRedis();
  if (!redis || !email) return { count: 0, blocked: false };
 
  const count = await redis.incr(violationKey(email));
  if (count >= VIOLATION_LIMIT) {
    await blockUser(email);
    return { count, blocked: true };
  }
  return { count, blocked: false };
}
 
export async function getViolationCount(email) {
  const redis = getRedis();
  if (!redis || !email) return 0;
  const count = await redis.get(violationKey(email));
  return Number(count) || 0;
}
 