import { Redis } from '@upstash/redis';

// Vercel Marketplace'dan "Upstash for Redis" qo'shsangiz, quyidagi environment
// variable'lardan biri avtomatik qo'shiladi (nomi provayderga qarab farq qilishi mumkin).
let client;
let warned = false;

export function getRedis() {
  if (client !== undefined) return client;

  const url =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL_KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_URL_KV_REST_API_TOKEN;
  if (!url || !token) {
    if (!warned) {
      console.warn(
        "Redis ulanmagan (UPSTASH_REDIS_REST_URL/TOKEN yo'q) — tarif/limit tekshiruvi o'chirilgan, hamma Lite sifatida ishlaydi."
      );
      warned = true;
    }
    client = null;
    return client;
  }

  client = new Redis({ url, token });
  return client;
}
