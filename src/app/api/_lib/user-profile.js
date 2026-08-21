import { getRedis } from './redis';

// ============================================================
// Foydalanuvchi profili (ism, familiya, suhbatda "ESLA" orqali o'rganilgan
// faktlar) — Redis'da saqlanadi, shunda foydalanuvchi boshqa qurilma yoki
// brauzerdan kirsa ham (localStorage'dan farqli o'laroq) ma'lumot yo'qolmaydi.
// Kalit nomlash uslubi user-plan.js bilan bir xil: tg:profile:<email>
// ============================================================

function profileKey(email) {
  return `tg:profile:${email}`;
}

/** Redis'dan foydalanuvchi profilini o'qiydi. Ulanish yo'q yoki topilmasa — bo'sh obyekt. */
export async function getUserProfile(email) {
  const redis = getRedis();
  if (!redis || !email) return {};

  const raw = await redis.get(profileKey(email));
  if (!raw) return {};
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/** Profilni TO'LIQ almashtirib yozadi (masalan tanishuv/onboarding yakunida). */
export async function saveUserProfile(email, profile) {
  const redis = getRedis();
  if (!redis || !email) return;
  await redis.set(profileKey(email), JSON.stringify(profile));
}

/** Mavjud profilga yangi maydonlarni QO'SHIB yozadi (masalan chatda o'rganilgan faktlar). */
export async function mergeUserProfile(email, patch) {
  if (!patch || !Object.keys(patch).length) return null;
  const current = await getUserProfile(email);
  const next = { ...current, ...patch };
  await saveUserProfile(email, next);
  return next;
}
