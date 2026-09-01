import { auth } from '@/auth';
import { isAdminEmail } from '../../_lib/admin';
 
// Admin panelidagi qo'shimcha parol (PIN) tekshiruvi — Google orqali kirish
// va admin ro'yxatida bo'lishning o'zi yetarli emas, bundan tashqari
// .env.local'dagi ADMIN_PANEL_PASSWORD ham to'g'ri kiritilishi kerak.
// Bu ikkinchi xavfsizlik qatlami: agar kimningdir Google hisobi o'g'irlansa
// yoki admin email noto'g'ri qo'shilib qolsa ham, parolsiz panelga kirib
// bo'lmaydi.
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
 
  if (!(await isAdminEmail(email))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
 
  const ADMIN_PASSWORD = process.env.ADMIN_PANEL_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return Response.json({ error: 'ADMIN_PANEL_PASSWORD .env.local\'da sozlanmagan' }, { status: 500 });
  }
 
  const { password } = await req.json().catch(() => ({}));
  if (password !== ADMIN_PASSWORD) {
    return Response.json({ error: "Parol noto'g'ri" }, { status: 401 });
  }
 
  return Response.json({ ok: true });
}