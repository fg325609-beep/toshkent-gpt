import { auth } from '@/auth';
import { saveSubscription } from '../../_lib/push';
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
 
  const subscription = await req.json().catch(() => null);
  if (!subscription?.endpoint) {
    return Response.json({ error: "Noto'g'ri obuna ma'lumoti." }, { status: 400 });
  }
 
  await saveSubscription(email, subscription).catch((err) => console.error('Push obunasini saqlashda xato:', err));
  return Response.json({ ok: true });
}
 