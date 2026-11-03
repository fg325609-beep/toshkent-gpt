import { auth } from '@/auth';
import { getUserState, resolveEffectivePlan, getUsageWindow, recordUsage, saveUserState } from '../_lib/user-plan';
import { touchUser } from '../_lib/admin';
import { getSettings } from '../_lib/settings';
import { recordEvent } from '../_lib/stats';

// ============================================================
// PODKAST → KLIP: uzun video/audiodan "hook"li qisqa kliplar.
//
// Og'ir ish (yuklab olish, Whisper transkripsiya, Gemini hook tanlash,
// ffmpeg montaj + subtitr) egasining kompyuteridagi lokal worker'da
// (local-worker/worker.py, /clips/* endpointlari) bajariladi — Vercel'da
// ffmpeg ham, 60 soniyadan uzun ish ham yo'q. Bu yerda faqat:
//   POST  — vazifani worker'ga yuborish (tarif va limit tekshiruvi bilan)
//   GET   — holatni so'rash (?requestId=)
// Klip fayllari /api/clips/file/<job>/<nom> orqali proksi qilinadi.
// ============================================================

export const maxDuration = 60;

function workerUrl() {
  const url = process.env.LOCAL_VIDEO_URL;
  if (!url) throw new Error("Montaj worker'i sozlanmagan (LOCAL_VIDEO_URL yo'q).");
  return url.replace(/\/$/, '');
}

// Qaysi tariflar foydalana oladi — CLIPS_ALLOWED_PLANS=lite,pro,max,promax bilan
// o'zgartiriladi. Standart: faqat pullik yuqori tariflar (worker egasining
// kompyuterida ishlaydi, bu arzon emas).
function allowedPlans() {
  return (process.env.CLIPS_ALLOWED_PLANS || 'max,promax')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const BLOB_HOST_RE = /\.blob\.vercel-storage\.com$/i;
const PAGE_HOST_RE = /(^|\.)(youtube\.com|youtu\.be|m\.youtube\.com|vimeo\.com|instagram\.com|tiktok\.com|facebook\.com|fb\.watch|t\.me)$/i;

function validateSource(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Havola noto'g'ri.");
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error("Faqat http(s) havola.");
  if (BLOB_HOST_RE.test(u.hostname) || PAGE_HOST_RE.test(u.hostname)) return u.toString();
  // To'g'ridan-to'g'ri media fayl havolasi ham bo'lishi mumkin.
  if (/\.(mp4|mov|webm|mkv|m4a|mp3|wav|ogg|aac)(\?|$)/i.test(u.pathname + u.search)) return u.toString();
  throw new Error('YouTube/Instagram/TikTok havolasi, yuklangan fayl yoki to\'g\'ridan-to\'g\'ri video havolasi bering.');
}

export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ error: 'Avval tizimga kiring.' }, { status: 401 });

  const settings = await getSettings().catch(() => null);
  if (settings?.features?.clips === false) {
    return Response.json({ error: 'Podkast → klip vaqtincha o\'chirilgan.' }, { status: 503 });
  }

  const state = await getUserState(email);
  const effective = resolveEffectivePlan(state);
  const planId = effective.plan?.id;

  if (!allowedPlans().includes(planId)) {
    return Response.json(
      { error: 'Podkast → klip faqat Max va Pro Max tariflarida mavjud.', requiresUpgrade: true, suggestedPlan: 'max' },
      { status: 402 }
    );
  }

  const win = getUsageWindow(state, undefined);
  const limit = effective.plan?.dailyLimit;
  if (typeof limit === 'number' && win.count >= limit) {
    return Response.json({ error: 'Kunlik limitingiz tugadi.' }, { status: 402 });
  }

  const body = await req.json().catch(() => null);
  let sourceUrl;
  try {
    sourceUrl = validateSource(String(body?.sourceUrl || '').trim());
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }

  const payload = {
    token: process.env.WORKER_TOKEN || '',
    source_url: sourceUrl,
    max_clip_seconds: Math.min(180, Math.max(15, Number(body?.maxClipSeconds) || 120)),
    // 0 = avtomatik (worker podkast uzunligiga qarab tanlaydi)
    clip_count: Math.min(8, Math.max(0, Number.isFinite(Number(body?.clipCount)) ? Number(body.clipCount) : 3)),
    aspect: ['9:16', '16:9', '1:1'].includes(body?.aspect) ? body.aspect : '9:16',
    subtitles: body?.subtitles !== false,
    language: ['uz', 'ru', 'en'].includes(body?.language) ? body.language : 'auto',
    brand_terms: Array.isArray(body?.brandTerms) ? body.brandTerms.map((t) => String(t).trim()).filter(Boolean).slice(0, 20) : [],
    instructions: String(body?.instructions || '').slice(0, 1000),
    remove_pauses: body?.removePauses !== false,
    smart_crop: body?.smartCrop !== false,
    quality: ['fast', 'high', 'max'].includes(body?.quality) ? body.quality : 'high',
  };

  try {
    const res = await fetch(`${workerUrl()}/clips/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.error || !data?.requestId) {
      throw new Error(data?.error || 'Worker javob bermadi. U yoqilganmi?');
    }

    touchUser(email, { name: session.user.name, image: session.user.image }).catch(() => {});
    recordUsage(state, undefined);
    saveUserState(email, state).catch((err) => console.error('Limit saqlashda xato:', err));
    recordEvent({ channel: 'klip', kind: 'klip', email, ok: true });

    return Response.json({ requestId: data.requestId });
  } catch (err) {
    console.error('Klip so\'rovida xato:', err);
    recordEvent({ channel: 'klip', kind: 'klip', email, ok: false, error: err?.message });
    const msg = /sozlanmagan/.test(err.message)
      ? err.message
      : "Montaj worker'iga ulanib bo'lmadi — u egasining kompyuterida yoqilgan bo'lishi kerak. Birozdan keyin qayta urinib ko'ring.";
    return Response.json({ error: msg }, { status: 503 });
  }
}

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: 'Avval tizimga kiring.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  if (!requestId || !/^[a-zA-Z0-9_-]{6,64}$/.test(requestId)) {
    return Response.json({ error: "So'rov identifikatori yo'q." }, { status: 400 });
  }

  try {
    const res = await fetch(`${workerUrl()}/clips/status/${requestId}`, { signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return Response.json({ state: 'error', message: 'Worker bilan aloqa uzildi.' });

    // Klip havolalarini o'z proksimizga yo'naltiramiz (worker manzili yashirin qoladi).
    if (Array.isArray(data.clips)) {
      data.clips = data.clips.map((c) => ({
        ...c,
        url: c.filename ? `/api/clips/file/${requestId}/${encodeURIComponent(c.filename)}` : c.url,
        thumbnailUrl: c.thumbnail_url
          ? `/api/clips/file/${requestId}/${encodeURIComponent(c.thumbnail_url.split('/').pop())}`
          : null,
      }));
    }
    return Response.json(data);
  } catch (err) {
    console.error('Klip holatini tekshirishda xato:', err);
    return Response.json({ state: 'error', message: "Worker bilan aloqa yo'q." });
  }
}
