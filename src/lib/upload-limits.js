// ============================================================
// Fayl yuklash chegaralari — brauzer ham, server ham shu yerdan o'qiydi.
//
// Ikki yo'l bor:
//   1) Vercel Blob (katta fayllar, video, audio) — brauzerdan to'g'ridan-to'g'ri,
//      multipart bilan, MAX_UPLOAD_BYTES gacha (standart 5 GB;
//      NEXT_PUBLIC_MAX_UPLOAD_MB bilan o'zgartiriladi). Blob sozlanmagan bo'lsa ishlamaydi.
//   2) Inline (base64, /api/chat so'rovi ichida) — faqat kichik fayllar,
//      chunki Vercel funksiyasi so'rov tanasini ~4.5 MB bilan cheklaydi.
// ============================================================
export const MAX_UPLOAD_BYTES = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 5120) * 1024 * 1024;

// Chatda AI tahlil qila oladigan eng katta fayl — Gemini Files API chegarasi
// (2 GB). Podkast → klip uchun bu chegara yo'q (worker Blob'dan o'zi oladi).
export const AI_FILE_MAX_BYTES = 2 * 1024 * 1024 * 1024;

// Inline (base64) yo'l bilan yuborish mumkin bo'lgan eng katta fayl.
export const INLINE_MAX_BYTES = 3 * 1024 * 1024;

// Gemini'ga "inline" (so'rov ichida) berish mumkin bo'lgan eng katta fayl —
// undan kattasi Gemini Files API orqali yuklanadi (2 GB gacha).
export const GEMINI_INLINE_MAX_BYTES = 7 * 1024 * 1024;

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Fayl nomi/turiga qarab qaysi toifaga kirishini aniqlaydi. */
export function classifyFile(name, mimeType) {
  const ext = (name || '').toLowerCase().split('.').pop();
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif', 'bmp'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', '3gp'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'aac', 'flac', 'opus'].includes(ext)) return 'audio';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (['docx', 'xlsx', 'xls', 'pptx'].includes(ext)) return 'doc';
  if (mime.startsWith('text/') || ['txt', 'md', 'json', 'csv', 'log', 'js', 'ts', 'py', 'html', 'css', 'xml', 'yml', 'yaml', 'sql'].includes(ext)) return 'text';
  return 'file';
}
