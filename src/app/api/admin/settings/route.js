import { auth } from '@/auth';
import { isAdminEmail } from '../../_lib/admin';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../../_lib/settings';

// Admin panelidagi "Ilova sozlamalari" bo'limi.
//   GET  /api/admin/settings — to'liq sozlamalar (standartlar bilan birga)
//   POST /api/admin/settings — body = qismiy o'zgarish (patch); saqlangan to'liq holat qaytadi
async function guard() {
  const session = await auth();
  return isAdminEmail(session?.user?.email);
}

export async function GET() {
  if (!(await guard())) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const settings = await getSettings();
  return Response.json({ settings, defaults: DEFAULT_SETTINGS }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req) {
  if (!(await guard())) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const patch = await req.json().catch(() => null);
  if (!patch || typeof patch !== 'object') {
    return Response.json({ error: 'Notoʻgʻri soʻrov.' }, { status: 400 });
  }

  try {
    const settings = await saveSettings(patch);
    return Response.json({ ok: true, settings });
  } catch (err) {
    console.error('Sozlamalarni saqlashda xato:', err);
    return Response.json({ error: err?.message || 'Saqlab boʻlmadi.' }, { status: 500 });
  }
}
