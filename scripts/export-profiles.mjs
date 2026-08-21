// ============================================================
// Redis'da (Vercel'dagi haqiqiy saytda) saqlangan barcha foydalanuvchi
// profillarini (ism, familiya, suhbatda o'rganilgan faktlar) mahalliy
// data/profiles-export.json fayliga tushiradi — shuni VS Code'da ochib,
// ma'lumotlarni ko'rish mumkin. Sayt sahifasida bu ma'lumot ko'rinmaydi.
//
// Ishlatish:  npm run export:profiles
//
// Diqqat: bu skript SIZNING kompyuteringizda ishlaydi (Vercel'da emas),
// .env.local fayldagi UPSTASH_REDIS_REST_URL / TOKEN orqali Redis'ga
// to'g'ridan-to'g'ri ulanadi.
// ============================================================

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { Redis } from '@upstash/redis';

// .env.local faylini qo'lda o'qiymiz (qo'shimcha "dotenv" paketi shart emas).
function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const content = readFileSync('.env.local', 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error(
    "❌ Xato: .env.local faylida UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN topilmadi.\n" +
      "   Vercel loyihangizda 'Upstash for Redis' ulangan bo'lishi va shu qiymatlar\n" +
      "   .env.local'ga ham (Vercel dashboard'dan nusxalab) qo'shilgan bo'lishi kerak."
  );
  process.exit(1);
}

const redis = new Redis({ url, token });

async function main() {
  const keys = await redis.keys('tg:profile:*');

  const result = {};
  for (const key of keys) {
    const email = key.replace('tg:profile:', '');
    const raw = await redis.get(key);
    result[email] = typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  mkdirSync('data', { recursive: true });
  const outPath = 'data/profiles-export.json';
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`✅ ${keys.length} ta foydalanuvchi profili "${outPath}" fayliga yozildi.`);
  if (keys.length === 0) {
    console.log('   (Hali hech kim tanishuvdan o\'tmagan yoki chatda fakt aytmagan bo\'lishi mumkin.)');
  }
}

main().catch((err) => {
  console.error('❌ Xato:', err.message || err);
  process.exit(1);
});
