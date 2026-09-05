import webpush from 'web-push';
import { auth } from '@/auth';
import { isAdminEmail } from '../../_lib/admin';
import { getAllSubscribedEmails, getUserSubscriptions, removeSubscription } from '../../_lib/push';
 
// Admin panelidan "hammaga e'lon yuborish" — masalan yangi funksiya chiqqanda
// yoki muhim xabar bo'lganda. Avtomatik (vaqt bo'yicha, masalan "sinov
// tugadi") eslatmalar bu yerda YO'Q — ular alohida vazifa (cron job) talab
// qiladi, buni keyingi qadamda alohida qo'shish mumkin.
export async function POST(req) {
  const session = await auth();
  const adminEmail = session?.user?.email;
 
  if (!(await isAdminEmail(adminEmail))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
 
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return Response.json({ error: "Push-bildirishnoma sozlanmagan (VAPID kalitlar yo'q)." }, { status: 500 });
  }
 
  const body = await req.json().catch(() => null);
  const title = (body?.title || 'ToshkentGPT').trim();
  const message = (body?.message || '').trim();
  if (!message) {
    return Response.json({ error: 'Xabar matni kiritilmadi.' }, { status: 400 });
  }
 
  webpush.setVapidDetails('mailto:admin@toshkent-gpt.vercel.app', vapidPublic, vapidPrivate);
 
  const emails = await getAllSubscribedEmails();
  let sent = 0;
  let failed = 0;
 
  for (const email of emails) {
    const subs = await getUserSubscriptions(email);
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({ title, body: message, url: '/' })
        );
        sent++;
      } catch (err) {
        failed++;
        // 410/404 — obuna eskirgan yoki bekor qilingan, tozalab qo'yamiz.
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await removeSubscription(email, sub.endpoint).catch(() => {});
        } else {
          console.error('Push yuborishda xato:', err?.message || err);
        }
      }
    }
  }
 
  return Response.json({ ok: true, sent, failed, totalUsers: emails.length });
}
 