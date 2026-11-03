// ============================================================
// Telegram Bot API bilan ishlash uchun yordamchi funksiyalar.
// Barcha so'rovlar to'g'ridan-to'g'ri Telegram serveriga (fetch orqali)
// yuboriladi — alohida kutubxona shart emas.
// ============================================================
 
function apiBase() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN .env.local'da sozlanmagan");
  return `https://api.telegram.org/bot${token}`;
}
 
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
 
/**
 * Oddiy markdown'ni (bot javoblarida ishlatiladigan) Telegram'ning HTML
 * formatiga o'giradi. To'liq markdown emas — eng ko'p uchraydigan
 * holatlar (qalin, kursiv, kod, sarlavha, ro'yxat) qamrab olinadi.
 */
export function markdownToTelegramHtml(md) {
  let text = escapeHtml(md);
  text = text.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, (_, code) => `<pre>${code}</pre>`);
  text = text.replace(/^#{1,6}\s*(.+)$/gm, '<b>$1</b>');
  text = text.replace(/^[-*]\s+/gm, '• ');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  text = text.replace(/\*([^*\n]+)\*/g, '<i>$1</i>');
  // [matn](https://...) havolalari — ilgari xom markdown ko'rinishida chiqar edi.
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

// ============================================================
// Foydalanuvchi yuborgan rasm/faylni Telegram serveridan yuklab olish.
// getFile -> file_path -> https://api.telegram.org/file/bot<token>/<path>
// Telegram 20 MB gacha fayl berishi mumkin; biz undan kichik chegara qo'yamiz.
// ============================================================
export const TELEGRAM_FILE_MAX_BYTES = 10 * 1024 * 1024;

export async function downloadTelegramFile(fileId) {
  const infoRes = await fetch(`${apiBase()}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const info = await infoRes.json().catch(() => null);
  const filePath = info?.result?.file_path;
  if (!infoRes.ok || !filePath) {
    throw new Error("Faylni Telegram'dan olib bo'lmadi.");
  }
  if (info.result.file_size && info.result.file_size > TELEGRAM_FILE_MAX_BYTES) {
    throw new Error('Fayl juda katta (10 MB dan oshmasin).');
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!fileRes.ok) throw new Error("Faylni yuklab bo'lmadi.");
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  if (buffer.length > TELEGRAM_FILE_MAX_BYTES) throw new Error('Fayl juda katta (10 MB dan oshmasin).');
  return { buffer, filePath };
}
 
/**
 * Telegram xabar uzunligi 4096 belgi bilan cheklangan — kerak bo'lsa bo'lib yuboradi.
 * options.buttons — davom-savol tugmalari (reply keyboard): ['Savol 1', 'Savol 2'].
 *   Oxirgi bo'lakka biriktiriladi; bosilganda matn oddiy xabar sifatida keladi.
 */
export async function sendTelegramMessage(chatId, rawText, options = {}) {
  const text = rawText && rawText.trim() ? rawText : 'Javob kelmadi.';
  const chunks = [];
  let remaining = text;
  while (remaining.length > 3800) {
    chunks.push(remaining.slice(0, 3800));
    remaining = remaining.slice(3800);
  }
  chunks.push(remaining);
 
  const buttons = Array.isArray(options.buttons) ? options.buttons.filter(Boolean).slice(0, 3) : [];
  const replyMarkup = buttons.length
    ? { keyboard: buttons.map((b) => [{ text: String(b).slice(0, 60) }]), resize_keyboard: true, one_time_keyboard: true }
    : options.removeKeyboard
      ? { remove_keyboard: true }
      : undefined;
 
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLast = i === chunks.length - 1;
    const base = { chat_id: chatId, ...(isLast && replyMarkup ? { reply_markup: replyMarkup } : {}) };
    const res = await fetch(`${apiBase()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...base, text: markdownToTelegramHtml(chunk), parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      // HTML formatlash muammo qilsa (masalan yopilmagan teg), oddiy matn bilan qayta urinamiz.
      await fetch(`${apiBase()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...base, text: chunk }),
      }).catch(() => {});
    }
  }
}
 
export async function sendTelegramPhoto(chatId, buffer, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  form.append('photo', new Blob([buffer]), 'rasm.png');
  const res = await fetch(`${apiBase()}/sendPhoto`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Telegram sendPhoto xatosi: ${res.status}`);
}
 
/** Video yuborish (Telegram bot orqali 50 MB gacha). */
export async function sendTelegramVideo(chatId, buffer, filename, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption.slice(0, 1000));
  form.append('supports_streaming', 'true');
  form.append('video', new Blob([buffer], { type: 'video/mp4' }), filename || 'klip.mp4');
  const res = await fetch(`${apiBase()}/sendVideo`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Telegram sendVideo xatosi: ${res.status}`);
}

export async function sendTelegramDocument(chatId, buffer, filename, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  form.append('document', new Blob([buffer]), filename || 'fayl');
  const res = await fetch(`${apiBase()}/sendDocument`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Telegram sendDocument xatosi: ${res.status}`);
}
 
/** "yozmoqda..." yoki "rasm yuklanmoqda..." kabi holat ko'rsatkichi. Xato bo'lsa ham muhim emas. */
export async function sendTelegramChatAction(chatId, action = 'typing') {
  await fetch(`${apiBase()}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}
 