import { getRedis } from '../../_lib/redis';
import { sendTelegramMessage, sendTelegramVideo } from '../../_lib/telegram';

// ============================================================
// Worker vazifani tugatgach shu manzilga xabar beradi (callback). Agar
// vazifa Telegram'dan (/klip <havola>) boshlangan bo'lsa — tayyor kliplar
// o'sha chatga video sifatida yuboriladi. Veb-saytdagi vazifalar uchun
// callback shart emas (sahifa o'zi holatni so'rab turadi).
//
// Xavfsizlik: X-Worker-Token sarlavhasi WORKER_TOKEN bilan bir xil bo'lishi
// shart (worker'ga submit'da callback_token sifatida beriladi).
// ============================================================

export const maxDuration = 300;

const TELEGRAM_VIDEO_MAX = 49 * 1024 * 1024;

export async function POST(req) {
  const token = req.headers.get('x-worker-token') || '';
  if (!process.env.WORKER_TOKEN || token !== process.env.WORKER_TOKEN) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const requestId = String(body?.requestId || '');
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(requestId)) {
    return Response.json({ error: 'requestId yo\'q' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) return Response.json({ ok: true, note: 'Redis yo\'q' });

  const raw = await redis.get(`tg:clipjob:${requestId}`).catch(() => null);
  if (!raw) return Response.json({ ok: true, note: 'Telegram vazifasi emas' });
  const job = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const chatId = job.chatId;
  await redis.del(`tg:clipjob:${requestId}`).catch(() => {});

  if (body.state === 'error') {
    await sendTelegramMessage(chatId, `❌ Klip yaratib bo'lmadi: ${body.message || "noma'lum xato"}`);
    return Response.json({ ok: true });
  }

  const clips = Array.isArray(body.clips) ? body.clips : [];
  if (!clips.length) {
    await sendTelegramMessage(chatId, 'Klip topilmadi — videoda yetarli nutq bo\'lmagan bo\'lishi mumkin.');
    return Response.json({ ok: true });
  }

  const base = (process.env.LOCAL_VIDEO_URL || '').replace(/\/$/, '');
  await sendTelegramMessage(chatId, `🎬 ${clips.length} ta klip tayyor! Yuborilmoqda...`);

  for (const clip of clips) {
    const caption = [clip.title ? `🎯 ${clip.title}` : null, clip.hook ? `“${clip.hook}”` : null, clip.start != null ? `⏱ ${fmt(clip.start)}–${fmt(clip.end)}` : null]
      .filter(Boolean)
      .join('\n');
    try {
      const res = await fetch(`${base}/clips/file/${requestId}/${encodeURIComponent(clip.filename)}`, { signal: AbortSignal.timeout(240000) });
      if (!res.ok) throw new Error(`fayl ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > TELEGRAM_VIDEO_MAX) {
        await sendTelegramMessage(chatId, `${caption}\n\n(Fayl 50 MB dan katta — saytdagi Podkast → klip bo'limidan yuklab oling.)`);
        continue;
      }
      await sendTelegramVideo(chatId, buffer, clip.filename, caption);
    } catch (err) {
      console.error('Telegram\'ga klip yuborishda xato:', err);
      await sendTelegramMessage(chatId, `${caption}\n\n(Yuborib bo'lmadi — saytdagi Podkast → klip bo'limidan yuklab oling.)`).catch(() => {});
    }
  }
  return Response.json({ ok: true });
}

function fmt(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
