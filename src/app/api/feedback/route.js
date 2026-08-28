// Shikoyat va takliflar formasidan kelgan xabarni Telegram botga yuboradi.
// TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID FAQAT .env.local (mahalliy) va
// Vercel Environment Variables (production/preview) orqali beriladi — kodga yozilmaydi.
import { auth } from '@/auth';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(req) {
  // Faqat tizimga kirgan foydalanuvchilar yubora oladi — aks holda botni
  // to'g'ridan-to'g'ri so'rov yuborib spam bilan to'ldirish mumkin bo'lardi.
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Avval tizimga kiring' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Notoʻgʻri soʻrov" }, { status: 400 });
  }

  const message = (body?.message || '').trim();
  const from = session.user.email;

  if (!message) {
    return Response.json({ error: "Xabar boʻsh boʻlishi mumkin emas" }, { status: 400 });
  }
  if (message.length > 2000) {
    return Response.json({ error: "Xabar juda uzun" }, { status: 400 });
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan');
    return Response.json({ error: "Server sozlanmagan" }, { status: 500 });
  }

  const text = `📩 ToshkentGPT — yangi fikr-mulohaza${from ? `\n👤 ${from}` : ''}\n\n${message}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });

    if (!tgRes.ok) {
      const errData = await tgRes.json().catch(() => null);
      console.error('Telegram API xatosi:', errData);
      return Response.json({ error: "Telegramga yuborilmadi" }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Feedback yuborishda xato:', err);
    return Response.json({ error: "Server xatosi" }, { status: 500 });
  }
}
