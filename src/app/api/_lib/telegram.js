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
  return text;
}
 
/** Telegram xabar uzunligi 4096 belgi bilan cheklangan — kerak bo'lsa bo'lib yuboradi. */
export async function sendTelegramMessage(chatId, rawText) {
  const text = rawText && rawText.trim() ? rawText : 'Javob kelmadi.';
  const chunks = [];
  let remaining = text;
  while (remaining.length > 3800) {
    chunks.push(remaining.slice(0, 3800));
    remaining = remaining.slice(3800);
  }
  chunks.push(remaining);
 
  for (const chunk of chunks) {
    const res = await fetch(`${apiBase()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: markdownToTelegramHtml(chunk), parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      // HTML formatlash muammo qilsa (masalan yopilmagan teg), oddiy matn bilan qayta urinamiz.
      await fetch(`${apiBase()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
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
 