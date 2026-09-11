// ============================================================
// AI video provayderi (rasm -> video).
//
// ATAYLAB "provayder qatlami" sifatida yozilgan: bugun fal.ai ishlatiladi,
// ertaga o'z RTX 5090 kompyuteringizda ComfyUI ishga tushirsangiz yoki
// boshqa xizmatga o'tsangiz — FAQAT .env.local'dagi sozlama o'zgaradi,
// qolgan kod (API route, sahifa) umuman tegilmaydi.
//
// Kerakli sozlamalar (.env.local):
//   FAL_KEY=...                              <- majburiy
//   FAL_VIDEO_MODEL=fal-ai/kling-video/v2.5-turbo/standard/image-to-video
// ============================================================
 
const FAL_QUEUE = 'https://queue.fal.run';
 
function falKey() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("Video xizmati sozlanmagan (.env.local'da FAL_KEY yo'q).");
  return key;
}
 
function modelId() {
  return process.env.FAL_VIDEO_MODEL || 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video';
}
 
/**
 * Video yaratish so'rovini NAVBATGA qo'yadi va darhol qaytadi.
 * Vercel funksiyasi 60 soniyada uzilgani, video esa 1-5 daqiqa olgani uchun
 * kutib turish MUMKIN EMAS — shuning uchun faqat "chek" (requestId) qaytariladi.
 */
export async function submitVideoJob({ imageDataUrl, prompt, duration = '5' }) {
  const model = modelId();
 
  // fal.ai image_url sifatida oddiy havolani ham, base64 data-URI'ni ham qabul qiladi.
  const res = await fetch(`${FAL_QUEUE}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      image_url: imageDataUrl,
      prompt: prompt || 'Subtle natural motion, cinematic, smooth camera movement',
      duration: String(duration),
    }),
  });
 
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `Video xizmati xatosi (${res.status}).`);
  }
  if (!data?.request_id) {
    throw new Error("Video so'rovini navbatga qo'yib bo'lmadi.");
  }
  return { requestId: data.request_id, model };
}
 
/**
 * Navbatdagi so'rov holatini tekshiradi.
 * Qaytadi: { state: 'pending' | 'done' | 'error', videoUrl?, message? }
 */
export async function checkVideoJob(requestId, model) {
  const m = model || modelId();
 
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
 
  // Turli modellar natijani biroz boshqacha shaklda qaytaradi — barchasini qamraymiz.
  const videoUrl = result?.video?.url || result?.videos?.[0]?.url || result?.output?.video?.url || null;
 
  if (!videoUrl) {
    return { state: 'error', message: "Video tayyor bo'ldi, lekin havolasi topilmadi." };
  }
  return { state: 'done', videoUrl };
}
 