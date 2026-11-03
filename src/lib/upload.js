import { upload } from '@vercel/blob/client';
import { fileToDataUrl, fileToText } from './files';
import { classifyFile, INLINE_MAX_BYTES, MAX_UPLOAD_BYTES } from './upload-limits';

// ============================================================
// Brauzer tomonida fayl biriktirish mantig'i.
//
// Kichik fayllar (≤ 3 MB) — eski usul: base64 ko'rinishida so'rov ichida
// yuboriladi (hech qanday sozlama kerak emas). Katta fayllar va HAR QANDAY
// video/audio — Vercel Blob'ga to'g'ridan-to'g'ri brauzerdan yuklanadi
// (500 MB gacha), chatga faqat havolasi boradi.
//
// Natija — "attachment" obyekti:
//   { id, kind: 'inline'|'blob', category, name, mimeType, size,
//     data? (base64), text? (matn fayllar), url? (blob), previewUrl? }
// ============================================================

export function safeUserSegment(email) {
  return (email || 'mehmon').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/**
 * Faylni biriktirmaga aylantiradi. onProgress(0..100) — Blob yuklanish jarayoni.
 * Xato bo'lsa — Error (matni foydalanuvchiga ko'rsatiladi).
 */
export async function prepareAttachment(file, { email, onProgress } = {}) {
  if (!file) throw new Error('Fayl tanlanmadi.');
  const category = classifyFile(file.name, file.type);
  const base = {
    id: newId(),
    category,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  };

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`"${file.name}" juda katta — ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB dan oshmasin.`);
  }

  // Rasm/video uchun lokal ko'rinish (preview) — serverga bormaydi.
  const previewUrl = category === 'image' || category === 'video' ? URL.createObjectURL(file) : null;

  // Matnli fayl — o'qib, to'g'ridan-to'g'ri yuboramiz.
  if (category === 'text' && file.size <= 300_000) {
    const text = await fileToText(file);
    return { ...base, kind: 'inline', data: btoa(unescape(encodeURIComponent(text))), previewUrl };
  }

  // Kichik fayl (rasm, PDF, Word, Excel) — base64 inline.
  const needsBlob = category === 'video' || category === 'audio' || file.size > INLINE_MAX_BYTES;
  if (!needsBlob) {
    const dataUrl = await fileToDataUrl(file);
    return { ...base, kind: 'inline', data: dataUrl.split(',')[1], previewUrl };
  }

  // Katta fayl — Vercel Blob.
  const pathname = `chat/${safeUserSegment(email)}/${Date.now()}-${file.name.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(0, 80)}`;
  try {
    const blob = await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      // Multipart: fayl bo'laklarga bo'linib parallel yuklanadi, uzilgan bo'lak
      // qayta yuboriladi — GB'lab podkastlar uchun yagona ishonchli yo'l.
      multipart: file.size > 8 * 1024 * 1024,
      onUploadProgress: (ev) => onProgress?.(Math.round(ev.percentage ?? (ev.loaded / (ev.total || file.size)) * 100)),
    });
    return { ...base, kind: 'blob', url: blob.url, previewUrl };
  } catch (err) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const msg = String(err?.message || err);
    if (/501|BLOB_READ_WRITE_TOKEN|sozlanmagan|not configured/i.test(msg)) {
      throw new Error("Katta fayl yuklash hali sozlanmagan — admin Vercel Blob'ni ulashi kerak. Hozircha 3 MB gacha fayl yuborsangiz bo'ladi.");
    }
    throw new Error(`Yuklab bo'lmadi: ${msg}`);
  }
}

/** Serverga yuboriladigan ko'rinish (preview va vaqtinchalik maydonlarsiz). */
export function toApiAttachment(att) {
  if (att.kind === 'blob') {
    return { kind: 'blob', category: att.category, name: att.name, mimeType: att.mimeType, size: att.size, url: att.url };
  }
  return { kind: 'inline', category: att.category, name: att.name, mimeType: att.mimeType, size: att.size, data: att.data };
}
