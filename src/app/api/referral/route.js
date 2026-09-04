import { auth } from '@/auth';
import { getOrCreateReferralCode, getReferralCount } from '../_lib/referral';
 
const SITE_URL = 'https://toshkent-gpt.vercel.app';
 
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
 
  try {
    const code = await getOrCreateReferralCode(email);
    const count = await getReferralCount(email);
    return Response.json({
      code,
      link: code ? `${SITE_URL}/?ref=${code}` : null,
      count,
    });
  } catch (err) {
    console.error('Referral kod olishda xato:', err);
    return Response.json({ error: 'Xatolik yuz berdi.' }, { status: 500 });
  }
}
 