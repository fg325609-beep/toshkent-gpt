import { getRedis } from './redis';

// ============================================================
// AI foydalanish telemetriyasi — FAQAT SONLAR, xabar matni hech qachon
// saqlanmaydi. Har bir AI so'rovi (chat, rasm, klip, ovoz...) tugagach
// `recordEvent(...)` chaqiriladi; admin panelidagi "AI foydalanish" va
// "Oxirgi xatolar" bo'limlari shu yerdan o'qiydi.
//
// Kalitlar (UTC kun bo'yicha, 60 kundan keyin o'z-o'zidan o'chadi):
//   tg:ev:<kun>:total            — jami so'rovlar
//   tg:ev:<kun>:ok / :err        — muvaffaqiyatli / xatolik
//   tg:ev:<kun>:ch:<kanal>       — web | telegram | voice | klip
//   tg:ev:<kun>:kind:<tur>       — chat | rasm | qidir | kod | prezentatsiya | klip | video | tts | stt | upload
//   tg:ev:<kun>:model:<model>    — qaysi model ishlatildi
//   tg:ev:<kun>:ms:sum / :ms:n   — javob vaqti yig'indisi va soni (o'rtacha uchun)
//   tg:ev:<kun>:user:<email>     — foydalanuvchi bo'yicha son
//   tg:ev:users:<kun>            — SET: shu kuni AI ishlatgan email'lar
//   tg:ev:dim:channel|kind|model — SET: ko'rilgan o'lchov nomlari (o'qishda MGET uchun)
//   tg:errors                    — LIST: oxirgi 200 xato (JSON, email niqoblangan)
//
// MUHIM: bu modul hech qachon xato tashlamaydi — telemetriya ishlamasa ham
// asosiy funksiya (chat) davom etishi shart.
// ============================================================

const TTL_SEC = 60 * 24 * 60 * 60; // 60 kun
const ERRORS_KEY = 'tg:errors';
const ERRORS_MAX = 200;

export const EVENT_CHANNELS = ['web', 'telegram', 'voice', 'klip'];
export const EVENT_KINDS = ['chat', 'rasm', 'qidir', 'kod', 'prezentatsiya', 'klip', 'video', 'tts', 'stt', 'upload'];

/** YYYY-MM-DD (UTC). */
function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Kalit nomida xavfsiz bo'lishi uchun qiymatni tozalaydi (bo'shliq, ikki nuqta va h.k.). */
function slug(value, max = 60) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s:]+/g, '-')
    .slice(0, max);
}

/** a***@gmail.com ko'rinishida niqoblaydi — xatolar ro'yxatida to'liq email saqlanmaydi. */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at <= 0) return email.slice(0, 1) + '***';
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Bitta AI hodisasini yozadi. "Fire-and-forget": await qilmasa ham bo'ladi,
 * hech qachon xato tashlamaydi.
 *
 * @param {object} ev
 * @param {'web'|'telegram'|'voice'|'klip'} ev.channel
 * @param {'chat'|'rasm'|'qidir'|'kod'|'prezentatsiya'|'klip'|'video'|'tts'|'stt'|'upload'} ev.kind
 * @param {string} [ev.email]
 * @param {boolean} [ev.ok=true]
 * @param {number} [ev.ms]      — javob vaqti (millisekund)
 * @param {string} [ev.model]   — ishlatilgan model nomi
 * @param {string|Error} [ev.error] — xato bo'lsa — matni (≤300 belgi saqlanadi)
 */
export async function recordEvent({ channel, kind, email, ok = true, ms, model, error } = {}) {
  try {
    const redis = getRedis();
    if (!redis) return;

    const day = dayKey();
    const base = `tg:ev:${day}`;
    const ch = slug(channel) || 'web';
    const kd = slug(kind) || 'chat';
    const md = model ? slug(model, 80) : '';
    const mail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const errText = error ? String(error?.message || error).slice(0, 300) : '';
    const failed = ok === false || Boolean(errText);

    const p = redis.pipeline();
    const touched = [];
    const incr = (key, by = 1) => {
      if (by === 1) p.incr(key);
      else p.incrby(key, by);
      touched.push(key);
    };

    incr(`${base}:total`);
    incr(failed ? `${base}:err` : `${base}:ok`);
    incr(`${base}:ch:${ch}`);
    incr(`${base}:kind:${kd}`);
    if (md) incr(`${base}:model:${md}`);
    if (Number.isFinite(ms) && ms >= 0) {
      incr(`${base}:ms:sum`, Math.round(ms));
      incr(`${base}:ms:n`);
    }
    if (mail) {
      incr(`${base}:user:${mail}`);
      p.sadd(`tg:ev:users:${day}`, mail);
      touched.push(`tg:ev:users:${day}`);
    }

    // O'lchov nomlari — o'qishda qaysi kalitlarni MGET qilishni bilish uchun.
    p.sadd('tg:ev:dim:channel', ch);
    p.sadd('tg:ev:dim:kind', kd);
    if (md) p.sadd('tg:ev:dim:model', md);

    if (errText) {
      p.lpush(
        ERRORS_KEY,
        JSON.stringify({
          t: new Date().toISOString(),
          channel: ch,
          kind: kd,
          email: maskEmail(mail),
          model: md,
          message: errText,
        })
      );
      p.ltrim(ERRORS_KEY, 0, ERRORS_MAX - 1);
    }

    for (const key of touched) p.expire(key, TTL_SEC);

    await p.exec();
  } catch (err) {
    // Telemetriya hech qachon asosiy ishni buzmasin.
    console.error('Telemetriya yozishda xato:', err?.message || err);
  }
}

/** Oxirgi N kun (bugun bilan birga) uchun YYYY-MM-DD ro'yxati, eskidan yangiga. */
function lastDays(days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

function emptyDay(date) {
  return { date, total: 0, ok: 0, err: 0, avgMs: 0, channels: {}, kinds: {}, models: {}, users: 0 };
}

/**
 * Admin paneli uchun jamlangan foydalanish statistikasi.
 * Bir nechta MGET/pipeline bilan — kun soni qancha bo'lsa ham 3-4 so'rov.
 *
 * @returns {Promise<{
 *   days: Array<{date:string,total:number,ok:number,err:number,avgMs:number,channels:object,kinds:object,models:object,users:number}>,
 *   totals: {total:number,ok:number,err:number,avgMs:number,channels:object,kinds:object,models:object,activeUsers:number},
 *   topUsers: Array<{email:string,count:number}>
 * }>}
 */
export async function getUsage(days = 14) {
  const n = Math.min(Math.max(Number(days) || 14, 1), 60);
  const dates = lastDays(n);
  const empty = {
    days: dates.map(emptyDay),
    totals: { total: 0, ok: 0, err: 0, avgMs: 0, channels: {}, kinds: {}, models: {}, activeUsers: 0 },
    topUsers: [],
  };

  const redis = getRedis();
  if (!redis) return empty;

  try {
    const today = dates[dates.length - 1];

    // 1) O'lchov nomlari + bugungi foydalanuvchilar + har kun uchun faol son.
    const p1 = redis.pipeline();
    p1.smembers('tg:ev:dim:channel');
    p1.smembers('tg:ev:dim:kind');
    p1.smembers('tg:ev:dim:model');
    p1.smembers(`tg:ev:users:${today}`);
    for (const d of dates) p1.scard(`tg:ev:users:${d}`);
    const r1 = await p1.exec();

    const channels = Array.from(new Set([...EVENT_CHANNELS, ...((r1[0] || []).map(String))]));
    const kinds = Array.from(new Set([...EVENT_KINDS, ...((r1[1] || []).map(String))]));
    const models = (r1[2] || []).map(String).slice(0, 40);
    const todayUsers = (r1[3] || []).map(String).slice(0, 500);
    const userCounts = r1.slice(4).map(toNum);

    // 2) Hamma kunlar uchun hamma hisoblagichlar — bitta MGET.
    const fields = [
      'total',
      'ok',
      'err',
      'ms:sum',
      'ms:n',
      ...channels.map((c) => `ch:${c}`),
      ...kinds.map((k) => `kind:${k}`),
      ...models.map((m) => `model:${m}`),
    ];
    const keys = [];
    for (const d of dates) for (const f of fields) keys.push(`tg:ev:${d}:${f}`);
    const values = keys.length ? await redis.mget(...keys) : [];

    // 3) Bugungi top foydalanuvchilar.
    let topUsers = [];
    if (todayUsers.length) {
      const counts = await redis.mget(...todayUsers.map((u) => `tg:ev:${today}:user:${u}`));
      topUsers = todayUsers
        .map((email, i) => ({ email, count: toNum(counts[i]) }))
        .filter((u) => u.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    // Natijani yig'ish.
    const totals = { total: 0, ok: 0, err: 0, msSum: 0, msN: 0, channels: {}, kinds: {}, models: {} };
    const activeUsers = new Set();
    const result = dates.map((date, di) => {
      const row = (f) => toNum(values[di * fields.length + fields.indexOf(f)]);
      const day = emptyDay(date);
      day.total = row('total');
      day.ok = row('ok');
      day.err = row('err');
      const msSum = row('ms:sum');
      const msN = row('ms:n');
      day.avgMs = msN > 0 ? Math.round(msSum / msN) : 0;
      day.users = userCounts[di] || 0;
      for (const c of channels) {
        const v = row(`ch:${c}`);
        if (v) {
          day.channels[c] = v;
          totals.channels[c] = (totals.channels[c] || 0) + v;
        }
      }
      for (const k of kinds) {
        const v = row(`kind:${k}`);
        if (v) {
          day.kinds[k] = v;
          totals.kinds[k] = (totals.kinds[k] || 0) + v;
        }
      }
      for (const m of models) {
        const v = row(`model:${m}`);
        if (v) {
          day.models[m] = v;
          totals.models[m] = (totals.models[m] || 0) + v;
        }
      }
      totals.total += day.total;
      totals.ok += day.ok;
      totals.err += day.err;
      totals.msSum += msSum;
      totals.msN += msN;
      return day;
    });

    // Davr bo'yicha faol foydalanuvchilar — kunlik SET'larni bitta SUNION bilan.
    try {
      const union = await redis.sunion(...dates.map((d) => `tg:ev:users:${d}`));
      for (const u of union || []) activeUsers.add(String(u));
    } catch {
      // SUNION ishlamasa — kunlik maksimum bilan kifoyalanamiz.
    }

    return {
      days: result,
      totals: {
        total: totals.total,
        ok: totals.ok,
        err: totals.err,
        avgMs: totals.msN > 0 ? Math.round(totals.msSum / totals.msN) : 0,
        channels: totals.channels,
        kinds: totals.kinds,
        models: totals.models,
        activeUsers: activeUsers.size || Math.max(0, ...userCounts),
      },
      topUsers,
    };
  } catch (err) {
    console.error("Foydalanish statistikasini o'qishda xato:", err?.message || err);
    return empty;
  }
}

/** Oxirgi xatolar (eng yangisi birinchi). */
export async function getRecentErrors(limit = 50) {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const n = Math.min(Math.max(Number(limit) || 50, 1), ERRORS_MAX);
    const raw = (await redis.lrange(ERRORS_KEY, 0, n - 1)) || [];
    return raw
      .map((item) => {
        try {
          return typeof item === 'string' ? JSON.parse(item) : item;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("Xatolar ro'yxatini o'qishda xato:", err?.message || err);
    return [];
  }
}

/** Xatolar ro'yxatini tozalaydi (hisoblagichlar o'zgarmaydi). */
export async function clearErrors() {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.del(ERRORS_KEY);
    return true;
  } catch (err) {
    console.error('Xatolar roʻyxatini tozalashda xato:', err?.message || err);
    return false;
  }
}
