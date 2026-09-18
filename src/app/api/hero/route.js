import { auth } from '@/auth';
import { getRedis } from '../_lib/redis';
import { isAdminEmail } from '../_lib/admin';
 
// ============================================================
// Boshlanish ekranidagi katta sarlavha ("Xo'sh, nimadan boshlaymiz?").
//
// Matni, rangi, shrifti va o'lchami admin panelidan o'zgartiriladi va
// Redis'da bitta kalitda (tg:hero) saqlanadi — kod qayta yozilmasdan,
// har kuni boshqa so'z yozib qo'yish mumkin.
//
//   GET  /api/hero  — hamma o'qiy oladi (ilova ochilganda)
//   POST /api/hero  — faqat admin yozadi
// ============================================================
const KEY = 'tg:hero';
 
export const DEFAULT_HERO = {
  text: 'Xoʻsh, nimadan boshlaymiz?',
  subtitle: '', // bo'sh bo'lsa — odatdagi salomlashuv matni ko'rinadi
  colorMode: 'gradient', // gradient | solid
  color: '#E4A93B',
  gradientFrom: '#F3EEE2',
  gradientTo: '#E4A93B',
  font: 'display', // display | sans | mono
  size: 'md', // sm | md | lg
};
 
// Kelgan ma'lumotni tozalab, faqat ruxsat etilgan qiymatlarni qoldiradi —
// shunda admin panelidan xato qiymat kelsa ham sahifa buzilmaydi.
function sanitize(input) {
  const out = { ...DEFAULT_HERO };
  if (typeof input?.text === 'string' && input.text.trim()) out.text = input.text.trim().slice(0, 120);
  if (typeof input?.subtitle === 'string') out.subtitle = input.subtitle.trim().slice(0, 200);
  if (input?.colorMode === 'solid' || input?.colorMode === 'gradient') out.colorMode = input.colorMode;
  for (const k of ['color', 'gradientFrom', 'gradientTo']) {
    if (typeof input?.[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(input[k])) out[k] = input[k];
  }
  if (['display', 'sans', 'mono'].includes(input?.font)) out.font = input.font;
  if (['sm', 'md', 'lg'].includes(input?.size)) out.size = input.size;
  return out;
}
 
export async function GET() {
  const redis = getRedis();
  if (!redis) return Response.json(DEFAULT_HERO);
 
  try {
    const raw = await redis.get(KEY);
    if (!raw) return Response.json(DEFAULT_HERO);
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Response.json(sanitize(parsed));
  } catch (err) {
    console.error("Sarlavhani o'qishda xato:", err);
    return Response.json(DEFAULT_HERO);
  }
}
 
export async function POST(req) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
 
  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: 'Redis ulanmagan — saqlab bo\'lmadi.' }, { status: 500 });
  }
 
  const body = await req.json().catch(() => null);
  const hero = sanitize(body);
 
  try {
    await redis.set(KEY, JSON.stringify(hero));
    return Response.json({ ok: true, hero });
  } catch (err) {
    console.error('Sarlavhani saqlashda xato:', err);
    return Response.json({ error: 'Saqlab bo\'lmadi.' }, { status: 500 });
  }
}
 