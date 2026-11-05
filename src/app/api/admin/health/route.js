import { auth } from '@/auth';
import { isAdminEmail } from '../../_lib/admin';
import { getRedis } from '../../_lib/redis';
import { APP_VERSION } from '@/lib/version';

// ============================================================
// Tizim holati — admin panelidagi "Tizim holati" bo'limi uchun JONLI
// tekshiruvlar. Har bir xizmat uchun { ok, ms, detail } qaytaradi.
// Maxfiy qiymatlar (kalit, token) HECH QACHON qaytarilmaydi — faqat
// "sozlanganmi / ishlayaptimi" degan javob.
// ============================================================

export const maxDuration = 30;

const GEMINI_TIMEOUT_MS = 8000;
const WORKER_TIMEOUT_MS = 6000;
const TELEGRAM_TIMEOUT_MS = 6000;
const BLOB_TIMEOUT_MS = 6000;

/** Vaqt o'lchab, xatoni ham natijaga aylantiradi — hech bir tekshiruv boshqasini to'xtatmaydi. */
async function timed(fn) {
  const t0 = Date.now();
  try {
    const extra = (await fn()) || {};
    return { ok: extra.ok !== false, ms: Date.now() - t0, ...extra };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, detail: String(err?.message || err).slice(0, 200) };
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: ${ms / 1000} soniyada javob bermadi`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function checkGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, detail: 'GEMINI_API_KEY sozlanmagan' };

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    // Eng arzon "jonli" tekshiruv: modellar ro'yxatidan 1 ta element.
    const pager = await withTimeout(
      ai.models.list({ config: { pageSize: 1, abortSignal: controller.signal, httpOptions: { timeout: GEMINI_TIMEOUT_MS } } }),
      GEMINI_TIMEOUT_MS,
      'Gemini'
    );
    const first = pager?.page?.[0];
    const models = [process.env.GEMINI_MODEL, process.env.GEMINI_MODEL_LITE, process.env.GEMINI_MODEL_PRO]
      .filter(Boolean)
      .filter((m, i, arr) => arr.indexOf(m) === i);
    return {
      ok: true,
      detail: first?.name ? `API ishlayapti · ${first.name.replace(/^models\//, '')}` : 'API ishlayapti',
      models,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkRedis() {
  const redis = getRedis();
  if (!redis) return { ok: false, detail: 'Redis ulanmagan (UPSTASH_REDIS_REST_URL/TOKEN yoʻq)' };
  const stamp = String(Date.now());
  await redis.set('tg:health:ping', stamp, { ex: 120 });
  const back = await redis.get('tg:health:ping');
  if (String(back) !== stamp) throw new Error('set/get mos kelmadi');
  return { ok: true, detail: 'Upstash · set/get ishlayapti' };
}

async function checkBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, detail: 'BLOB_READ_WRITE_TOKEN sozlanmagan' };
  const { list } = await import('@vercel/blob');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BLOB_TIMEOUT_MS);
  try {
    const res = await withTimeout(list({ limit: 1, abortSignal: controller.signal }), BLOB_TIMEOUT_MS, 'Blob');
    const count = Array.isArray(res?.blobs) ? res.blobs.length : 0;
    return { ok: true, detail: count ? 'Vercel Blob · fayllar bor' : 'Vercel Blob · boʻsh' };
  } finally {
    clearTimeout(timer);
  }
}

async function checkWorker() {
  const url = process.env.LOCAL_VIDEO_URL;
  if (!url) return { ok: false, detail: 'LOCAL_VIDEO_URL sozlanmagan (worker ishlatilmaydi)', configured: false };
  const base = url.replace(/\/$/, '');
  const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(WORKER_TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok) throw new Error(`Worker ${res.status} qaytardi`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Worker JSON qaytarmadi');
  const parts = [data.device, data.tier ? `tier: ${data.tier}` : '', data.backend].filter(Boolean);
  return {
    ok: data.ok !== false,
    detail: parts.join(' · ') || 'Worker ishlayapti',
    configured: true,
    device: data.device || '',
    backend: data.backend || '',
    vramGb: data.vram_gb ?? null,
    tier: data.tier || '',
    frames: data.frames ?? null,
    size: data.size ?? null,
    clips: data.clips || null,
  };
}

async function checkTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, detail: 'TELEGRAM_BOT_TOKEN sozlanmagan' };
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.description || `Telegram ${res.status} qaytardi`);
  const info = data.result || {};
  const pending = Number(info.pending_update_count) || 0;
  const hasWebhook = Boolean(info.url);
  return {
    ok: hasWebhook && !info.last_error_message,
    detail: hasWebhook
      ? info.last_error_message
        ? `Webhook xatosi: ${String(info.last_error_message).slice(0, 120)}`
        : `Webhook oʻrnatilgan · ${pending} ta kutilayotgan`
      : 'Webhook oʻrnatilmagan',
    url: info.url || '',
    pendingUpdates: pending,
    lastError: info.last_error_message || '',
    lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
    username: process.env.TELEGRAM_BOT_USERNAME || '',
  };
}

function checkAuth() {
  const ok = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  return { ok, detail: ok ? 'Google OAuth sozlangan' : 'AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET yoʻq' };
}

function checkPush() {
  const ok = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  return { ok, detail: ok ? 'VAPID kalitlari sozlangan' : 'VAPID kalitlari yoʻq — push ishlamaydi' };
}

function checkCron() {
  const ok = Boolean(process.env.CRON_SECRET);
  return { ok, detail: ok ? 'CRON_SECRET sozlangan · kunlik 08:00 UTC' : 'CRON_SECRET yoʻq — cron himoyalanmagan' };
}

// Qaysi ixtiyoriy sozlamalar mavjud — FAQAT true/false, qiymat emas.
const ENV_FLAGS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_MODEL_LITE',
  'GEMINI_MODEL_PRO',
  'GEMINI_MODEL_MAX',
  'GEMINI_MODEL_PROMAX',
  'GEMINI_IMAGE_MODEL',
  'GEMINI_TTS_MODEL',
  'UPSTASH_REDIS_REST_URL',
  'KV_REST_API_URL',
  'BLOB_READ_WRITE_TOKEN',
  'AUTH_GOOGLE_ID',
  'AUTH_GOOGLE_SECRET',
  'AUTH_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PANEL_PASSWORD',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_USERNAME',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_CHAT_ID',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'CRON_SECRET',
  'LOCAL_VIDEO_URL',
  'WORKER_TOKEN',
  'VIDEO_PROVIDER',
  'IMAGE_PROVIDER',
  'FAL_KEY',
  'CLIPS_ALLOWED_PLANS',
];

export async function GET() {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const t0 = Date.now();
  const [gemini, redis, blob, worker, telegram] = await Promise.all([
    timed(checkGemini),
    timed(checkRedis),
    timed(checkBlob),
    timed(checkWorker),
    timed(checkTelegram),
  ]);

  const env = {};
  for (const k of ENV_FLAGS) env[k] = Boolean(process.env[k]);

  return Response.json(
    {
      at: new Date().toISOString(),
      totalMs: Date.now() - t0,
      checks: {
        gemini,
        redis,
        blob,
        worker,
        telegram,
        auth: { ms: 0, ...checkAuth() },
        push: { ms: 0, ...checkPush() },
        cron: { ms: 0, ...checkCron() },
      },
      env,
      version: APP_VERSION,
      node: process.version,
      region: process.env.VERCEL_REGION || 'local',
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || '',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
