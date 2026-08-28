import { getRedis } from './redis';
import { PLANS } from '../../plans';

function todayKey() {
  // Server vaqti bo'yicha kunlik limit sanog'i (YYYY-MM-DD).
  return new Date().toISOString().slice(0, 10);
}

function defaultState() {
  return {
    plan: 'lite',
    planExpiresAt: null,
    usage: { date: todayKey(), count: 0, windowStart: null },
  };
}

function userKey(email) {
  return `tg:user:${email}`;
}

export async function getUserState(email) {
  const redis = getRedis();
  if (!redis || !email) return defaultState();

  // Redis noto'g'ri sozlangan yoki vaqtincha ulanmasa ham,
  // /api/chat butunlay 500 bilan qulab tushmasin.
  try {
    const raw = await redis.get(userKey(email));
    if (!raw) return defaultState();

    const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...defaultState(), ...state, usage: { ...defaultState().usage, ...(state.usage || {}) } };
  } catch (err) {
    console.error("Redis'dan foydalanuvchi holatini o'qishda xato:", err);
    return defaultState();
  }
}

export async function saveUserState(email, state) {
  const redis = getRedis();
  if (!redis || !email) return;
  await redis.set(userKey(email), JSON.stringify(state));
}

// Foydalanuvchining HOZIRGI foydalanish oynasi holatini hisoblaydi.
//  - cooldownHours berilsa: "aylanma oyna" — limitga yetilgan payitdan aynan shuncha
//    soat o'tgach, hisob avtomatik nolga tushadi (masalan Pro bepul sinovi: 3 soatda 1 marta).
//  - berilmasa: kalendar kuni bo'yicha (har kuni yarim tunda nolga tushadi) — oddiy kunlik limit.
export function getUsageWindow(state, cooldownHours) {
  const now = Date.now();

  if (cooldownHours) {
    const windowMs = cooldownHours * 60 * 60 * 1000;
    const windowStart = state.usage?.windowStart ? new Date(state.usage.windowStart).getTime() : 0;
    const fresh = !windowStart || now - windowStart >= windowMs;
    const count = fresh ? 0 : state.usage?.count || 0;
    const unlockAt = fresh ? null : new Date(windowStart + windowMs).toISOString();
    return { count, unlockAt, fresh };
  }

  const sameDay = state.usage?.date === todayKey();
  const count = sameDay ? state.usage?.count || 0 : 0;
  return { count, unlockAt: null, fresh: !sameDay };
}

// Muvaffaqiyatli javobdan keyin sanoqni +1 qiladi — oyna turiga (kunlik/aylanma) mos ravishda.
export function recordUsage(state, cooldownHours) {
  if (cooldownHours) {
    const { fresh } = getUsageWindow(state, cooldownHours);
    const prevCount = fresh ? 0 : state.usage?.count || 0;
    state.usage = {
      ...state.usage,
      windowStart: fresh ? new Date().toISOString() : state.usage?.windowStart,
      count: prevCount + 1,
    };
    return state;
  }

  const sameDay = state.usage?.date === todayKey();
  state.usage = {
    ...state.usage,
    date: todayKey(),
    count: (sameDay ? state.usage?.count || 0 : 0) + 1,
  };
  return state;
}

// Foydalanuvchining hozirgi holatiga qarab, unga QAYSI tarif AMALDA ekanini va qanday
// rejimda (active / trial / downgraded) ekanini aniqlaydi.
//  - lite: doim faol (bepul, kunlik limit bilan)
//  - pro/max/promax: agar to'lov muddati (planExpiresAt) o'tmagan bo'lsa -> "active" (to'liq kunlik limit)
//  - pro (to'lovsiz, plan.trial bor): trial.limit gacha -> "trial" rejimida faol (cooldown oynasi bilan)
//  - aks holda -> Lite'ga tushadi, "downgraded" belgisi va qachon ochilishi (unlockAt) bilan
export function resolveEffectivePlan(state) {
  const now = Date.now();
  const hasActiveSub = state.planExpiresAt && new Date(state.planExpiresAt).getTime() > now;

  if (state.plan === 'lite' || !PLANS[state.plan]) {
    return { plan: PLANS.lite, mode: 'active' };
  }

  if (hasActiveSub) {
    return { plan: PLANS[state.plan], mode: 'active' };
  }

  const plan = PLANS[state.plan];

  if (plan?.trial) {
    const win = getUsageWindow(state, plan.trial.cooldownHours);
    if (win.count < plan.trial.limit) {
      return { plan, mode: 'trial' };
    }
    return { plan: PLANS.lite, mode: 'downgraded', wantedPlan: plan, unlockAt: win.unlockAt };
  }

  return { plan: PLANS.lite, mode: 'downgraded', wantedPlan: plan, unlockAt: null };
}

export async function setUserPlan(email, planId, months = 1) {
  const state = await getUserState(email);
  const now = new Date();
  const base =
    state.planExpiresAt && new Date(state.planExpiresAt).getTime() > now.getTime()
      ? new Date(state.planExpiresAt)
      : now;
  base.setMonth(base.getMonth() + months);

  const next = { ...state, plan: planId, planExpiresAt: base.toISOString() };
  await saveUserState(email, next);
  return next;
}
