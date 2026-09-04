import { auth } from '@/auth';
import { isAdminEmail, getDailyStats } from '../../_lib/admin';
 
// Admin panelidagi statistika grafigi uchun: oxirgi 14 kunlik "faol
// foydalanuvchi" va "yangi ro'yxatdan o'tgan" sonlarini qaytaradi.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
 
  if (!(await isAdminEmail(email))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
 
  const days = await getDailyStats(14);
  return Response.json({ days });
}
 