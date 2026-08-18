import { auth } from '@/auth';
import { getRedis } from '../../_lib/redis';
import { setUserPlan } from '../../_lib/user-plan';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;

  if (!ADMIN_EMAIL) {
    return Response.json({ error: 'ADMIN_EMAIL sozlanmagan' }, { status: 500 });
  }
  if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id, months } = await req.json().catch(() => ({}));
  if (!id) {
    return Response.json({ error: "So'rov ID kerak" }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: "Redis yo'q" }, { status: 500 });
  }

  const raw = await redis.get(`tg:upgrade:${id}`);
  if (!raw) {
    return Response.json({ error: "So'rov topilmadi" }, { status: 404 });
  }
  const request = typeof raw === 'string' ? JSON.parse(raw) : raw;

  await setUserPlan(request.email, request.plan, months || 1);

  request.status = 'approved';
  request.approvedAt = new Date().toISOString();
  await redis.set(`tg:upgrade:${id}`, JSON.stringify(request));
  await redis.lrem('tg:upgrade:pending', 0, id);

  return Response.json({ ok: true });
}
