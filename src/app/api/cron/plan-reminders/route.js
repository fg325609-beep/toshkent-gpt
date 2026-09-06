import webpush from 'web-push';
import { listTrackedUsers } from '../../_lib/admin';
import { getUserState } from '../../_lib/user-plan';
import { getUserSubscriptions, removeSubscription } from '../../_lib/push';
import { getRedis } from '../../_lib/redis';
import { PLANS } from '@/app/plans';
 
// ============================================================
// Vercel Cron har kuni shu manzilga so'rov yuboradi (vercel.json'da
// sozlangan). Tarifi 24 soat ichida tugaydigan foydalanuvchilarga
// push-bildirishnoma orqali eslatma yuboradi — HAR BIR FOYDALANUVCHIGA
// FAQAT BIR MARTA (qayta-qayta yubormaslik uchun belgi qo'yiladi).
// ============================================================
 
const REMINDER_WINDOW_HOURS = 24;
const notifiedKey = (email) => `tg:notified-expiry:${email}`;
 
export async function GET(req) {
  // Faqat Vercel Cron'ning o'zi (yoki CRON_SECRET bilgan kishi) chaqira olishi kerak —
  // aks holda istalgan kishi bu manzilni ochib, hammaga keraksiz push yubortirib yuborishi mumkin.
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Forbidden', { status: 403 });
  }
 
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return Response.json({ ok: false, error: "VAPID kalitlar sozlanmagan." });
  }
  webpush.setVapidDetails('mailto:admin@toshkent-gpt.vercel.app', vapidPublic, vapidPrivate);
 
  const redis = getRedis();
  const users = await listTrackedUsers();
  const now = Date.now();
  let remindersSent = 0;
 
  for (const user of users) {
    const state = await getUserState(user.email).catch(() => null);
    if (!state?.plan || state.plan === 'lite' || !state.planExpiresAt) continue;
 
    const expiresAt = new Date(state.planExpiresAt).getTime();
    const hoursLeft = (expiresAt - now) / (1000 * 60 * 60);
 
    // Faqat "tez orada tugaydi" oynasida (0-24 soat qolganda) va hali
    // ogohlantirilmagan bo'lsa.
    if (hoursLeft <= 0 || hoursLeft > REMINDER_WINDOW_HOURS) continue;
 
    const alreadyNotified = redis ? await redis.get(notifiedKey(user.email)) : null;
    if (alreadyNotified) continue;
 
    const subs = await getUserSubscriptions(user.email);
    if (subs.length === 0) continue;
 
    const planName = PLANS[state.plan]?.name || state.plan;
    const payload = JSON.stringify({
      title: 'ToshkentGPT',
      body: `${planName} tarifingiz tez orada tugaydi. Uzaytirish uchun ilovaga kiring.`,
      url: '/',
    });
 
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload);
        remindersSent++;
      } catch (err) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await removeSubscription(user.email, sub.endpoint).catch(() => {});
        }
      }
    }
 
    // Shu tarif muddati uchun QAYTA yubormaslik uchun belgi (48 soatga yetarli).
    if (redis) await redis.set(notifiedKey(user.email), '1', { ex: 60 * 60 * 48 });
  }
 
  return Response.json({ ok: true, checkedUsers: users.length, remindersSent });
}