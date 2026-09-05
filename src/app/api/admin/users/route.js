import { auth } from '@/auth';
import { isAdminEmail, listTrackedUsers } from '../../_lib/admin';
import { getUserProfile } from '../../_lib/user-profile';
import { isUserBlocked } from '../../_lib/moderation';
 
// Admin panelidagi "kimlar bor" jadvali uchun: har bir foydalanuvchining
// ism/familiya/qiziqishlari (chatda "ESLA" orqali yig'ilgan barcha faktlar),
// birinchi/oxirgi faollik vaqti, onlayn va BLOKLANGAN holatini qaytaradi.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
 
  if (!(await isAdminEmail(email))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
 
  const tracked = await listTrackedUsers();
 
  // Har bir foydalanuvchi uchun to'liq profilni (ism, familiya va boshqa
  // yig'ilgan faktlar) ham qo'shib olamiz. Foydalanuvchilar soni odatda
  // kichik (indie loyiha) bo'lgani uchun N ta alohida so'rov muammo emas.
  const users = await Promise.all(
    tracked.map(async (u) => {
      const [profile, blocked] = await Promise.all([
        getUserProfile(u.email).catch(() => ({})),
        isUserBlocked(u.email).catch(() => false),
      ]);
      return { ...u, profile, blocked };
    })
  );
 
  users.sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));
 
  return Response.json({
    users,
    total: users.length,
    onlineCount: users.filter((u) => u.online).length,
  });
}
 