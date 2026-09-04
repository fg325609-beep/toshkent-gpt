import { auth } from '@/auth';
import { redeemReferralCode } from '../../_lib/referral';
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
 
  const body = await req.json().catch(() => null);
  const code = body?.code;
  if (!code || typeof code !== 'string') {
    return Response.json({ error: "Kod kiritilmadi." }, { status: 400 });
  }
 
  const result = await redeemReferralCode(code, email);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
 
  return Response.json(result);
}
 