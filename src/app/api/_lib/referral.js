import { getRedis } from './redis';
import { grantBonusDays } from './user-plan';
 
// ============================================================
// Do'stni taklif qilish (referral) tizimi. Har bir foydalanuvchi doimiy,
// bir martalik yaratiladigan kod oladi. Kimdir shu kod bilan ro'yxatdan
// o'tsa — IKKALASI HAM bonus kunlik Pro tarif oladi.
// ============================================================
 
const REWARD_PLAN = 'pro';
const REWARD_DAYS = 2;
 
const codeToEmailKey = (code) => `tg:ref-code:${code}`;
const emailToCodeKey = (email) => `tg:ref-code-for:${email}`;
const countKey = (email) => `tg:ref-count:${email}`;
const referredByKey = (email) => `tg:ref-referred-by:${email}`;
 
function randomCode() {
  // 6 ta harf/raqamdan iborat, o'qishga qulay kod (0/O, 1/I kabi chalkash
  // belgilarsiz).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
 
/** Foydalanuvchining doimiy referral kodini qaytaradi — yo'q bo'lsa, yangi yaratadi. */
export async function getOrCreateReferralCode(email) {
  const redis = getRedis();
  if (!redis || !email) return null;
 
  const existing = await redis.get(emailToCodeKey(email));
  if (existing) return existing;
 
  // Kod band bo'lib qolmasligi uchun (juda kam ehtimol, lekin) qayta urinamiz.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const taken = await redis.get(codeToEmailKey(code));
    if (!taken) {
      await redis.set(codeToEmailKey(code), email);
      await redis.set(emailToCodeKey(email), code);
      return code;
    }
  }
  throw new Error("Referral kod yaratib bo'lmadi, qayta urinib ko'ring.");
}
 
export async function getReferralCount(email) {
  const redis = getRedis();
  if (!redis || !email) return 0;
  const count = await redis.get(countKey(email));
  return Number(count) || 0;
}
 
/**
 * Kodni "ishlatadi": yangi foydalanuvchini taklif qilgan kishiga bog'laydi,
 * ikkalasiga ham bonus beradi. Faqat HAR BIR foydalanuvchi uchun BIR MARTA
 * ishlaydi (o'zini o'zi taklif qilish yoki bir necha marta bonus olish
 * mumkin emas).
 */
export async function redeemReferralCode(code, newUserEmail) {
  const redis = getRedis();
  if (!redis || !code || !newUserEmail) {
    return { ok: false, error: "Xizmat vaqtincha ishlamayapti." };
  }
 
  const alreadyReferred = await redis.get(referredByKey(newUserEmail));
  if (alreadyReferred) {
    return { ok: false, error: 'Siz allaqachon taklif havolasidan foydalangansiz.' };
  }
 
  const referrerEmail = await redis.get(codeToEmailKey(code.toUpperCase().trim()));
  if (!referrerEmail) {
    return { ok: false, error: "Noto'g'ri yoki eskirgan taklif kodi." };
  }
  if (referrerEmail === newUserEmail) {
    return { ok: false, error: "O'zingizni o'zingiz taklif qila olmaysiz 🙂" };
  }
 
  await redis.set(referredByKey(newUserEmail), referrerEmail);
  await redis.incr(countKey(referrerEmail));
 
  await grantBonusDays(referrerEmail, REWARD_PLAN, REWARD_DAYS).catch((err) =>
    console.error('Referral mukofoti (taklif qiluvchi) berishda xato:', err)
  );
  await grantBonusDays(newUserEmail, REWARD_PLAN, REWARD_DAYS).catch((err) =>
    console.error('Referral mukofoti (yangi foydalanuvchi) berishda xato:', err)
  );
 
  return { ok: true, days: REWARD_DAYS, planId: REWARD_PLAN };
}
 