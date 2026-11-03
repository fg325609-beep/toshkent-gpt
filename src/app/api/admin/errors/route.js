import { auth } from '@/auth';
import { isAdminEmail } from '../../_lib/admin';
import { getRecentErrors, clearErrors } from '../../_lib/stats';

// Admin panelidagi "Oxirgi xatolar" bo'limi.
//   GET    /api/admin/errors?limit=50  — oxirgi xatolar (eng yangisi birinchi)
//   DELETE /api/admin/errors           — ro'yxatni tozalash
async function guard() {
  const session = await auth();
  return isAdminEmail(session?.user?.email);
}

export async function GET(req) {
  if (!(await guard())) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const limit = Number(new URL(req.url).searchParams.get('limit')) || 50;
  const errors = await getRecentErrors(limit);
  return Response.json({ errors, count: errors.length }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE() {
  if (!(await guard())) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const ok = await clearErrors();
  if (!ok) {
    return Response.json({ error: 'Redis ulanmagan — tozalab boʻlmadi.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
