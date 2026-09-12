// ============================================================
// Lokal worker orqali rasm chizish.
//
// Pollinations bepul xizmati tavsifni to'g'ri o'qimay qo'ygani uchun
// (tasodifiy rasm qaytaradi), rasm ham o'z kompyuterimizda chiziladi.
//
// Sozlamalar (.env.local):
//   IMAGE_PROVIDER=local
//   LOCAL_VIDEO_URL=https://...trycloudflare.com   (worker manzili)
//   WORKER_TOKEN=parol
// ============================================================
 
function workerUrl() {
  const url = process.env.LOCAL_VIDEO_URL;
  if (!url) throw new Error("Lokal worker sozlanmagan (LOCAL_VIDEO_URL yo'q).");
  return url.replace(/\/$/, '');
}
 
/**
 * Rasm chizadi va tayyor bo'lguncha kutadi.
 * Worker navbat usulida ishlagani uchun, shu yerda tekshirib turamiz.
 */
export async function generateImageViaLocal(prompt) {
  const base = workerUrl();
 
  const submitRes = await fetch(`${base}/image/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, token: process.env.WORKER_TOKEN || '' }),
  });
  const submitted = await submitRes.json().catch(() => null);
  if (!submitRes.ok || submitted?.error || !submitted?.requestId) {
    throw new Error(submitted?.error || 'Kompyuteringizdagi worker javob bermadi. U yoqilganmi?');
  }
 
  // Kutish muddati. Sekin uskunada (masalan RX 550) rasm 1-3 daqiqa oladi,
  // shuning uchun sozlanadigan qilingan. Vercel'da 60 soniyalik cheklov bor,
  // lekin O'Z KOMPYUTERINGIZDA (localhost) bunday cheklov yo'q — shuning
  // uchun standart qiymat 5 daqiqa.
  const waitMs = Number(process.env.LOCAL_IMAGE_TIMEOUT_MS || 300_000);
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
 
    const statusRes = await fetch(`${base}/image/status/${submitted.requestId}`);
    const status = await statusRes.json().catch(() => null);
    if (!status) continue;
 
    if (status.state === 'done' && status.image) {
      return { base64: status.image, mimeType: 'image/png' };
    }
    if (status.state === 'error') {
      throw new Error(status.message || 'Worker rasm chizishda xato berdi.');
    }
  }
 
  throw new Error(
    `Rasm ${Math.round(waitMs / 1000)} soniyada tayyor bo'lmadi. ` +
      "Worker terminalini tekshiring: model hali yuklab olinayotgan bo'lishi mumkin."
  );
}
 