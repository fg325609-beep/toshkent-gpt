import { auth } from '@/auth';
import { getRedis } from '../../_lib/redis';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;

  if (!ADMIN_EMAIL) {
    return Response.json({ error: "ADMIN_EMAIL sozlanmagan" }, { status: 500 });
  }
  if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return Response.json({ error: 'Ruxsat yo\'q' }, { status: 403 });
  }

  const redis = getRedis();
  if (!redis) {
    return Response.json({ requests: [] });
  }

  const ids = (await redis.lrange('tg:upgrade:pending', 0, -1)) || [];
  const requests = [];
  for (const id of ids) {
    const raw = await redis.get(`tg:upgrade:${id}`);
    if (!raw) continue;
    const reqData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (reqData.status === 'pending') requests.push(reqData);
  }
  requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return Response.json({ requests });
}
