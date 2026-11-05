import { getRedis } from './redis';

// ============================================================
// Serverdan boshqariladigan ilova sozlamalari.
//
// Admin panelidan o'zgartiriladi (POST /api/admin/settings), hamma o'qiy
// oladi (GET /api/settings). Redis'da BITTA JSON kalitda (tg:settings)
// saqlanadi; modul xotirasida 20 soniya keshlanadi — har so'rovda Redis'ga
// murojaat bo'lmasin.
//
//   announcement — bosh sahifadagi e'lon bandi (matn, daraja, havola, muddat)
//   maintenance  — texnik ishlar rejimi (chat o'chiriladi, xabar ko'rinadi)
//   features     — alohida imkoniyatlarni yoqish/o'chirish
//   limits       — sonli cheklovlar (masalan yuklash hajmi)
// ============================================================

const KEY = 'tg:settings';
const CACHE_TTL_MS = 20_000;

export const ANNOUNCEMENT_LEVELS = ['info', 'warn', 'success'];

export const DEFAULT_SETTINGS = Object.freeze({
  announcement: {
    text: '',
    level: 'info', // info | warn | success
    link: '',
    until: null, // ISO sana — shu vaqtdan keyin e'lon ko'rinmaydi
    enabled: false,
  },
  maintenance: {
    enabled: false,
    message: '',
  },
  features: {
    autoTools: true, // AI o'zi kerakli vositani (rasm, qidiruv...) tanlashi
    followups: true, // javob ostidagi davom-savol tugmalari
    thinkingSummaries: true, // "o'ylash" jarayonining qisqa izohi
    clips: true, // Podkast -> klip studiyasi
    videoAi: true, // rasm -> video
    imageGen: true, // /rasm — rasm chizish
  },
  limits: {
    maxUploadMb: 5120,
  },
});

let cache = null; // { value, at }

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Chuqur birlashtirish: faqat DEFAULT_SETTINGS'da bor kalitlar olinadi. */
function deepMerge(base, patch) {
  const out = { ...base };
  if (!isPlainObject(patch)) return out;
  for (const key of Object.keys(base)) {
    if (!(key in patch)) continue;
    const b = base[key];
    const p = patch[key];
    out[key] = isPlainObject(b) ? deepMerge(b, p) : p;
  }
  return out;
}

function toBool(v, fallback) {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1' || v === 'on') return true;
  if (v === 'false' || v === 0 || v === '0' || v === 'off' || v === '') return false;
  return fallback;
}

function toText(v, max, fallback = '') {
  if (typeof v !== 'string') return fallback;
  return v.trim().slice(0, max);
}

/** Havola — faqat http(s) yoki ilova ichidagi yo'l (/klip). Boshqa hamma narsa bo'sh bo'ladi. */
function toLink(v) {
  const s = toText(v, 500);
  if (!s) return '';
  if (/^https?:\/\/[^\s]+$/i.test(s)) return s;
  if (/^\/[^\s]*$/.test(s) && !s.startsWith('//')) return s;
  return '';
}

function toIsoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Kelgan ma'lumotni tozalab, faqat ruxsat etilgan qiymatlarni qoldiradi. */
export function sanitizeSettings(input) {
  const merged = deepMerge(clone(DEFAULT_SETTINGS), input);
  const d = DEFAULT_SETTINGS;

  const announcement = {
    text: toText(merged.announcement?.text, 300),
    level: ANNOUNCEMENT_LEVELS.includes(merged.announcement?.level) ? merged.announcement.level : d.announcement.level,
    link: toLink(merged.announcement?.link),
    until: toIsoOrNull(merged.announcement?.until),
    enabled: toBool(merged.announcement?.enabled, d.announcement.enabled),
  };

  const maintenance = {
    enabled: toBool(merged.maintenance?.enabled, d.maintenance.enabled),
    message: toText(merged.maintenance?.message, 300),
  };

  const features = {};
  for (const k of Object.keys(d.features)) {
    features[k] = toBool(merged.features?.[k], d.features[k]);
  }

  const maxUploadRaw = Number(merged.limits?.maxUploadMb);
  const limits = {
    maxUploadMb:
      Number.isFinite(maxUploadRaw) && maxUploadRaw > 0
        ? Math.min(Math.round(maxUploadRaw), 20480)
        : d.limits.maxUploadMb,
  };

  return { announcement, maintenance, features, limits };
}

/**
 * Joriy sozlamalar (standartlar bilan birlashtirilgan). Redis yo'q yoki xato
 * bo'lsa — standartlar qaytadi, ilova hech qachon buzilmaydi.
 */
export async function getSettings() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  let value = clone(DEFAULT_SETTINGS);
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(KEY);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        value = sanitizeSettings(parsed);
      }
    } catch (err) {
      console.error("Sozlamalarni o'qishda xato:", err?.message || err);
    }
  }
  cache = { value, at: Date.now() };
  return value;
}

/**
 * Sozlamalarni qismiy yangilaydi (deep-merge + tozalash) va saqlaydi.
 * Redis ulanmagan bo'lsa xato tashlaydi — admin bilib qo'yishi kerak.
 * @returns saqlangan to'liq sozlamalar
 */
export async function saveSettings(patch) {
  const redis = getRedis();
  if (!redis) throw new Error('Redis ulanmagan — sozlamalar saqlanmadi.');

  // Keshni chetlab, Redis'dagi joriy holatni olamiz — shunda ikki admin
  // ketma-ket saqlasa, biri ikkinchisining o'zgarishini yo'qotmaydi.
  let current = clone(DEFAULT_SETTINGS);
  try {
    const raw = await redis.get(KEY);
    if (raw) current = sanitizeSettings(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    // joriy holat o'qilmasa — standartlar ustiga yozamiz
  }

  const next = sanitizeSettings(deepMerge(current, patch));
  await redis.set(KEY, JSON.stringify(next));
  cache = { value: next, at: Date.now() };
  return next;
}

/** Texnik ishlar rejimi yoqilganmi? (chat/telegram/voice marshrutlari tekshiradi) */
export async function isMaintenance() {
  try {
    const s = await getSettings();
    return Boolean(s?.maintenance?.enabled);
  } catch {
    return false;
  }
}

/** Muddati o'tmagan va yoqilgan e'lonni qaytaradi, aks holda null. */
export function activeAnnouncement(settings) {
  const a = settings?.announcement;
  if (!a?.enabled || !a.text) return null;
  if (a.until && new Date(a.until).getTime() < Date.now()) return null;
  return a;
}

/** Faqat testlar uchun — keshni tozalash. */
export function _resetSettingsCache() {
  cache = null;
}
