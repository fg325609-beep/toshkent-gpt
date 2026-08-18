import { auth } from '@/auth';
import { getRedis } from '../_lib/redis';
import { PLANS } from '../../plans';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Avval tizimga kiring' }, { status: 401 });
  }

  const { plan } = await req.json().catch(() => ({}));
  if (!plan || !PLANS[plan] || !PLANS[plan].paid) {
    return Response.json({ error: "Noto'g'ri tarif" }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: "Server sozlanmagan (Redis yo'q)" }, { status: 500 });
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const request = {
    id,
    email,
    name: session.user.name || null,
    plan,
    planName: PLANS[plan].name,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await redis.set(`tg:upgrade:${id}`, JSON.stringify(request));
  await redis.lpush('tg:upgrade:pending', id);

  if (BOT_TOKEN && CHAT_ID) {
    const text =
      `💳 Yangi to'lov so'rovi\n` +
      `👤 ${request.name || ''} (${email})\n` +
      `📦 Tarif: ${request.planName}\n` +
      `🆔 ${id}\n\n` +
      `Tasdiqlash uchun: /admin sahifasiga kiring.`;
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text }),
      });
    } catch (err) {
      console.error('Telegram xabarnomasi yuborilmadi:', err);
    }
  }

  return Response.json({ ok: true, id });
}
