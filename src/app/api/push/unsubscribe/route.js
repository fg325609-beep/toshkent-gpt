import { auth } from '@/auth';
import { removeSubscription } from '../../_lib/push';
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
 
  const body = await req.json().catch(() => null);
  if (!body?.endpoint) {
    return Response.json({ error: "Noto'g'ri so'rov." }, { status: 400 });
  }
 
  await removeSubscription(email, body.endpoint).catch((err) => console.error('Push obunasini o‘chirishda xato:', err));
  return Response.json({ ok: true });
}
 