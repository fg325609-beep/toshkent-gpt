import { auth } from '@/auth';
import { isAdminEmail, listExtraAdmins, addAdminEmail } from '../../_lib/admin';
 
const PRIMARY_ADMIN = process.env.ADMIN_EMAIL || '';
 
// Adminlar ro'yxatini ko'rish va yangi admin qo'shish. Faqat HOZIRGI
// adminlar (asosiy yoki qo'shilgan) boshqa odamni admin qila oladi.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
 
  if (!(await isAdminEmail(email))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
 
  const extra = await listExtraAdmins();
  return Response.json({ primary: PRIMARY_ADMIN, extra });
}
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
 
  if (!(await isAdminEmail(email))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
 
  const { email: newAdminEmail } = await req.json().catch(() => ({}));
  const normalized = (newAdminEmail || '').trim().toLowerCase();
 
  if (!normalized || !normalized.includes('@')) {
    return Response.json({ error: "To'g'ri email kiriting" }, { status: 400 });
  }
 
  await addAdminEmail(normalized);
  return Response.json({ ok: true });
}
 