import { auth } from '@/auth';
import { getUserState, resolveEffectivePlan, getUsageWindow, recordUsage, saveUserState } from '../_lib/user-plan';
import { submitVideoJob, checkVideoJob } from '@/lib/ai-video';
 
// Har bir video HAQIQIY pul turadi (~$0.30-0.50), shuning uchun bu funksiya
// FAQAT pullik yuqori tariflarda ochiq — aks holda bepul foydalanuvchilar
// kreditni bir kunda tugatib qo'yishi mumkin.
const ALLOWED_PLANS = ['max', 'promax'];
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Avval tizimga kiring.' }, { status: 401 });
  }
 
  const state = await getUserState(email);
  const effective = resolveEffectivePlan(state);
  const planId = effective.plan?.id;
 
  if (!ALLOWED_PLANS.includes(planId)) {
    return Response.json(
      {
        error: 'AI video faqat Max va Pro Max tariflarida mavjud.',
        requiresUpgrade: true,
        suggestedPlan: 'max',
      },
      { status: 402 }
    );
  }
 
  // Kunlik limitni video uchun ham hisobga olamiz.
  const win = getUsageWindow(state, undefined);
  const limit = effective.plan?.dailyLimit;
  if (typeof limit === 'number' && win.count >= limit) {
    return Response.json({ error: 'Kunlik limitingiz tugadi.' }, { status: 402 });
  }
 
  const body = await req.json().catch(() => null);
  const imageDataUrl = body?.image;
  const prompt = (body?.prompt || '').trim();
  const duration = body?.duration === '10' ? '10' : '5';
 
  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    return Response.json({ error: 'Rasm yuborilmadi.' }, { status: 400 });
  }
  // ~8 MB dan katta base64 so'rovlar Vercel'da rad etiladi.
  if (imageDataUrl.length > 8_000_000) {
    return Response.json({ error: 'Rasm juda katta (6 MB dan kichik boʻlsin).' }, { status: 400 });
  }
 
  try {
    const { requestId, model } = await submitVideoJob({ imageDataUrl, prompt, duration });
 
    // So'rov muvaffaqiyatli navbatga tushgach limitdan bittasini yechamiz.
    recordUsage(state, undefined);
    saveUserState(email, state).catch((err) => console.error('Limit saqlashda xato:', err));
 
    return Response.json({ requestId, model });
  } catch (err) {
    console.error('AI video so\'rovida xato:', err);
    return Response.json({ error: err.message || 'Xatolik yuz berdi.' }, { status: 500 });
  }
}
 
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Avval tizimga kiring.' }, { status: 401 });
  }
 
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  const model = searchParams.get('model') || undefined;
 
  if (!requestId) {
    return Response.json({ error: "So'rov identifikatori yo'q." }, { status: 400 });
  }
 
  try {
    const result = await checkVideoJob(requestId, model);
    return Response.json(result);
  } catch (err) {
    console.error('AI video holatini tekshirishda xato:', err);
    return Response.json({ state: 'error', message: err.message || 'Xatolik.' }, { status: 500 });
  }
}
 