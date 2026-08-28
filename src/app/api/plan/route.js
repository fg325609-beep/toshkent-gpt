import { auth } from '@/auth';
import { getUserState, resolveEffectivePlan, getUsageWindow } from '../_lib/user-plan';

// ============================================================
// Foydalanuvchining HOZIRGI tarif holatini (xabar sarflamasdan) o'qish uchun.
// /tariflar sahifasi shu orqali "Joriy tarifingiz" belgisini to'g'ri ko'rsatadi —
// hatto foydalanuvchi hali birorta ham xabar yubormagan bo'lsa ham.
// ============================================================

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json(null);

  const userState = await getUserState(email);
  const { plan, mode } = resolveEffectivePlan(userState);
  const cooldownHours = mode === 'trial' ? plan.trial?.cooldownHours : undefined;
  const limit = mode === 'trial' ? plan.trial.limit : plan.dailyLimit;
  const win = getUsageWindow(userState, cooldownHours);

  return Response.json({
    id: plan.id,
    name: plan.name,
    mode,
    limit,
    used: win.count,
    remaining: Math.max(0, limit - win.count),
    resetAt: win.unlockAt || null,
  });
}
