import { getSettings, activeAnnouncement } from '../_lib/settings';

// ============================================================
// Ommaviy sozlamalar — ilova ochilganda klient shu yerdan o'qiydi
// (autentifikatsiya shart emas). E'lon faqat yoqilgan va muddati o'tmagan
// bo'lsa qaytadi; texnik ishlar rejimi, imkoniyat bayroqlari va cheklovlar
// har doim qaytadi.
//   GET /api/settings
// ============================================================
export async function GET() {
  const s = await getSettings();
  return Response.json(
    {
      announcement: activeAnnouncement(s),
      maintenance: s.maintenance,
      features: s.features,
      limits: s.limits,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
