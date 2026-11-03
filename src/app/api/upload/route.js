import { handleUpload } from '@vercel/blob/client';
import { auth } from '@/auth';
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';
import { getSettings } from '../_lib/settings';
import { recordEvent } from '../_lib/stats';

// ============================================================
// KATTA FAYLLARNI YUKLASH — Vercel Blob orqali, TO'G'RIDAN-TO'G'RI brauzerdan.
//
// Nima uchun: Vercel serverless funksiyasi so'rov tanasini ~4.5 MB bilan
// cheklaydi. Ilgari rasm/PDF base64 ko'rinishida /api/chat ga yuborilar edi —
// shuning uchun katta fayl va video UMUMAN yuklanmas edi. Endi:
//
//   brauzer ──(1) token so'raydi──> /api/upload ──> handleUpload (shu fayl)
//   brauzer ──(2) faylni o'zi Blob'ga yuboradi (serverdan o'tmaydi, 500 MB gacha)
//   brauzer ──(3) /api/chat ga faqat { url, name, mimeType, size } yuboradi
//   server  ──(4) Blob'dan o'qiydi -> kichik bo'lsa inline, katta/video bo'lsa
//                 Gemini Files API orqali modelga beradi (_lib/attachments.js)
//
// Sozlash: Vercel → Storage → Blob → "Connect to project" (BLOB_READ_WRITE_TOKEN
// o'zi qo'shiladi). Token bo'lmasa, mijoz avvalgi base64 usuliga tushadi.
// ============================================================

const ALLOWED_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/*',
  'application/json',
  'application/octet-stream',
];

export async function POST(request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Avval tizimga kiring.' }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: 'Katta fayl yuklash sozlanmagan (BLOB_READ_WRITE_TOKEN).', notConfigured: true }, { status: 501 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Noto'g'ri so'rov." }, { status: 400 });
  }

  // Admin paneldan belgilangan chegara (MB) — build'siz o'zgartiriladi.
  const settings = await getSettings().catch(() => null);
  const adminMb = Number(settings?.limits?.maxUploadMb) || 0;
  const maxBytes = adminMb > 0 ? Math.min(MAX_UPLOAD_BYTES, adminMb * 1024 * 1024) : MAX_UPLOAD_BYTES;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Har bir foydalanuvchi faqat o'z papkasiga yozadi; nom tasodifiy
        // qo'shimcha bilan — bir xil nomli fayllar bir-birini bosmaydi.
        const safeUser = email.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
        if (!pathname.startsWith(`chat/${safeUser}/`)) {
          throw new Error("Ruxsat etilmagan yo'l.");
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: maxBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ email }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Statistika uchun (tur). Fayl chatga yuborilganda ishlatiladi.
        let who = null;
        try {
          who = JSON.parse(tokenPayload || '{}').email || null;
        } catch {}
        recordEvent({ channel: 'web', kind: 'upload', email: who, ok: true, model: blob?.contentType });
      },
    });
    return Response.json(result);
  } catch (err) {
    console.error('Blob upload xatosi:', err);
    return Response.json({ error: err.message || 'Yuklashda xatolik.' }, { status: 400 });
  }
}
