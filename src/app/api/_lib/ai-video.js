// ============================================================
// AI video provayderi (rasm -> video).
//
// IKKI USULNI qo'llab-quvvatlaydi, ALMASHTIRISH BITTA SOZLAMA orqali:
//
//   VIDEO_PROVIDER=local   -> o'z kompyuteringizdagi worker (bepul, kalitsiz)
//   VIDEO_PROVIDER=fal     -> fal.ai buluti (tez, lekin pullik)
//
// Lokal uchun:  LOCAL_VIDEO_URL, WORKER_TOKEN
// fal.ai uchun: FAL_KEY, FAL_VIDEO_MODEL
// ============================================================

const FAL_QUEUE = 'https://queue.fal.run';

function provider() {
  return (process.env.VIDEO_PROVIDER || 'local').toLowerCase();
}

// ---------- LOKAL WORKER ----------
function localUrl() {
  const url = process.env.LOCAL_VIDEO_URL;
  if (!url) throw new Error("Lokal video worker sozlanmagan (LOCAL_VIDEO_URL yo'q).");
  return url.replace(/\/$/, '');
}

async function localSubmit(imageDataUrl) {
  const res = await fetch(`${localUrl()}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl, token: process.env.WORKER_TOKEN || '' }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    throw new Error(data?.error || 'Kompyuteringizdagi worker javob bermadi. U yoqilganmi?');
  }
  return { requestId: data.requestId, model: 'local' };
}

async function localCheck(requestId) {
  const res = await fetch(`${localUrl()}/status/${requestId}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) return { state: 'error', message: 'Worker bilan aloqa uzildi.' };

  if (data.state === 'done') {
    // Worker videoni base64 sifatida qaytaradi — brauzer to'g'ridan-to'g'ri ko'rsata oladi.
    return { state: 'done', videoUrl: `data:video/mp4;base64,${data.video}` };
  }
  if (data.state === 'error') return { state: 'error', message: data.message };
  return { state: 'pending', message: data.message || 'Yaratilmoqda' };
}

// ---------- FAL.AI ----------
function falKey() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("fal.ai sozlanmagan (FAL_KEY yo'q).");
  return key;
}

function falModel() {
  // Standart: fal-ai/stable-video — Kling'dan ~3 barobar arzon ($0.075/video).
  // Kling'ga qaytish kerak bo'lsa: .env.local'da
  //   FAL_VIDEO_MODEL=fal-ai/kling-video/v2.5-turbo/standard/image-to-video
  return process.env.FAL_VIDEO_MODEL || 'fal-ai/stable-video';
}

// stable-video modeli matnli buyruqni (prompt) TUSHUNMAYDI — u faqat
// "harakat kuchi" (motion_bucket_id, 1-180) va kadr tezligini (fps) qabul qiladi.
// Shuning uchun foydalanuvchi yozgan tavsifni to'liq "tarjima" qilib bo'lmaydi —
// faqat kalit so'zlarga qarab taxminiy harakat kuchini tanlaymiz.
function promptToSvdParams(prompt, duration) {
  const p = (prompt || '').toLowerCase();

  let motion = 127; // o'rtacha (fal standarti)
  const strong = ['tez', 'kuchli', 'keskin', 'shiddat', 'portla', 'sakra', 'yugur', 'aylan', 'chop'];
  const soft = ['sekin', 'asta', 'yumshoq', 'sokin', 'tinch', 'osoyishta', 'yengil'];
  if (strong.some((w) => p.includes(w))) motion = 180;
  else if (soft.some((w) => p.includes(w))) motion = 60;

  // SVD 25 kadr yasaydi (fal'ning standart konfiguratsiyasi) — so'ralgan
  // davomiylikka fps orqali taxminiy moslashamiz.
  const seconds = duration === '10' ? 10 : 5;
  const fps = Math.max(4, Math.min(25, Math.round(25 / seconds)));

  return { motion_bucket_id: motion, fps, cond_aug: 0.02 };
}

async function falSubmit(imageDataUrl, prompt, duration) {
  const model = falModel();
  const isSvd = /stable-video/i.test(model);

  const body = isSvd
    ? { image_url: imageDataUrl, ...promptToSvdParams(prompt, duration) }
    : {
        image_url: imageDataUrl,
        prompt: prompt || 'Subtle natural motion, cinematic, smooth camera movement',
        duration: String(duration || '5'),
      };

  const res = await fetch(`${FAL_QUEUE}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || data?.error || `fal.ai xatosi (${res.status}).`);
  if (!data?.request_id) throw new Error("So'rovni navbatga qo'yib bo'lmadi.");
  return { requestId: data.request_id, model };
}

async function falCheck(requestId, model) {
  const m = model && model !== 'local' ? model : falModel();

  const statusRes = await fetch(`${FAL_QUEUE}/${m}/requests/${requestId}/status`, {
    headers: { Authorization: `Key ${falKey()}` },
  });
  const status = await statusRes.json().catch(() => null);
  if (!statusRes.ok) {
    return { state: 'error', message: status?.detail || `Holatni tekshirib bo'lmadi (${statusRes.status}).` };
  }
  if (status?.status !== 'COMPLETED') {
    return { state: 'pending', message: status?.status || 'IN_QUEUE' };
  }

  const resultRes = await fetch(`${FAL_QUEUE}/${m}/requests/${requestId}`, {
    headers: { Authorization: `Key ${falKey()}` },
  });
  const result = await resultRes.json().catch(() => null);
  const videoUrl =
    result?.video?.url ||
    result?.videos?.[0]?.url ||
    result?.output?.video?.url ||
    result?.data?.video?.url ||
    null;

  if (!videoUrl) return { state: 'error', message: 'Video tayyor, lekin havolasi topilmadi.' };
  return { state: 'done', videoUrl };
}

// ---------- UMUMIY INTERFEYS ----------
export async function submitVideoJob({ imageDataUrl, prompt, duration }) {
  if (provider() === 'fal') return falSubmit(imageDataUrl, prompt, duration);
  return localSubmit(imageDataUrl);
}

export async function checkVideoJob(requestId, model) {
  if (provider() === 'fal' && model !== 'local') return falCheck(requestId, model);
  return localCheck(requestId);
}