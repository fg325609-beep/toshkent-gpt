import { auth } from '@/auth';
import { isAdminEmail } from '../../_lib/admin';
import { getUsage } from '../../_lib/stats';

// Admin panelidagi "AI foydalanish" bo'limi: oxirgi N kun (7/14/30) uchun
// kunlik so'rovlar, xatolar, o'rtacha javob vaqti, kanal/tur/model bo'yicha
// taqsimot va bugungi eng faol foydalanuvchilar.
//   GET /api/admin/usage?days=14
export async function GET(req) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const days = Number(new URL(req.url).searchParams.get('days')) || 14;
  const usage = await getUsage(Math.min(Math.max(days, 1), 60));
  return Response.json(usage, { headers: { 'Cache-Control': 'no-store' } });
}
