import { auth } from '@/auth';
import { getUserState, saveUserState } from '../_lib/user-plan';
import { PLANS } from '../../plans';

export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Avval tizimga kiring' }, { status: 401 });
  }

  const { plan } = await req.json().catch(() => ({}));
  if (!plan || !PLANS[plan]?.trial) {
    return Response.json({ error: "Bu tarifda bepul sinov yo'q" }, { status: 400 });
  }

  const state = await getUserState(email);

  const hasActiveSub = state.planExpiresAt && new Date(state.planExpiresAt).getTime() > Date.now();
  if (hasActiveSub) {
    return Response.json({ error: 'Sizda allaqachon faol tarif bor' }, { status: 400 });
  }

  // Faqat "qaysi tarifni sinab ko'rmoqchi" degan belgini o'zgartiramiz — to'lov
  // muddati (planExpiresAt) va foydalanish sanog'iga tegmaymiz.
  const next = { ...state, plan };
  await saveUserState(email, next);

  return Response.json({ ok: true });
}
