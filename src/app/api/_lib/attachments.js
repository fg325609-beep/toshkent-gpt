import { extractText, getDocumentProxy } from 'unpdf';
import { extractDocumentText } from './document-extract';
import { documentSection, DOCUMENT_TEXT_MAX } from './ai-generation';
import { getRedis } from './redis';
import { classifyFile, GEMINI_INLINE_MAX_BYTES, AI_FILE_MAX_BYTES } from '@/lib/upload-limits';

// ============================================================
// Biriktirilgan fayllarni AI uchun tayyorlash — BITTA joyda.
//
// Chat ikki xil biriktirma qabul qiladi:
//   { kind: 'inline', category, name, mimeType, data }   — kichik fayl, base64
//   { kind: 'blob',   category, name, mimeType, size, url } — Vercel Blob'dagi katta fayl
//
// Natija: Gemini Interactions API'ning `input` massiviga qo'shiladigan
// elementlar ({type:'image'|'video'|'audio'|'document', data|uri, mime_type})
// va matnga qo'shiladigan hujjat bo'laklari.
//
// Katta fayl va VIDEO/AUDIO Gemini Files API orqali yuklanadi (2 GB gacha) —
// shunda model videoni "ko'radi", audio'ni "eshitadi". Yuklangan fayl 48 soat
// saqlanadi; bir xil Blob qayta yuborilsa (masalan "qayta yozdirish"), Redis
// keshidan tayyor URI olinadi — qayta yuklanmaydi.
// ============================================================

const BLOB_HOST_RE = /\.blob\.vercel-storage\.com$/i;
const FILE_CACHE_TTL = 40 * 60 * 60; // soniya (Gemini fayli 48 soat yashaydi)

function isAllowedBlobUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && BLOB_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

// Kichik fayllar (hujjat, rasm) — xotiraga o'qiladi. Katta video/audio esa
// xotiraga sig'maydi (Vercel funksiyasi ~1-3 GB) — ular uchun pastdagi
// streamBlobToGemini() ishlatiladi: Blob'dan oqim → to'g'ri Gemini'ga.
const BUFFER_MAX_BYTES = 200 * 1024 * 1024;

async function headBlob(url) {
  if (!isAllowedBlobUrl(url)) throw new Error("Faqat yuklangan (Blob) fayllar qabul qilinadi.");
  const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) }).catch(() => null);
  const size = Number(res?.headers?.get('content-length') || 0);
  const type = res?.headers?.get('content-type') || '';
  return { size, type };
}

async function fetchBlob(url) {
  if (!isAllowedBlobUrl(url)) throw new Error("Faqat yuklangan (Blob) fayllar qabul qilinadi.");
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`Faylni o'qib bo'lmadi (${res.status}).`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > BUFFER_MAX_BYTES) throw new Error('Fayl xotiraga sig\'maydi — oqim usuli kerak.');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > BUFFER_MAX_BYTES) throw new Error('Fayl juda katta.');
  return buffer;
}

/**
 * KATTA fayl (GB'lab video/audio): Blob'dan Gemini Files API'ga OQIM bilan
 * yuklaydi — bitta bayt ham funksiya xotirasida to'planmaydi.
 * Gemini'ning "resumable upload" protokoli: start → upload+finalize (bitta
 * so'rov, tanasi oqim). Node 20+ `duplex: 'half'` bilan oqimli tana yuboradi.
 */
export async function streamBlobToGemini(ai, blobUrl, { mimeType, name, size, cacheKey, onStatus }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY yo\'q');
  if (size > AI_FILE_MAX_BYTES) throw new Error('AI 2 GB dan katta faylni tahlil qila olmaydi — Podkast → klip bo\'limidan foydalaning.');

  const redis = getRedis();
  if (redis && cacheKey) {
    try {
      const cached = await redis.get(`tg:gemini-file:${cacheKey}`);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        const info = await ai.files.get({ name: parsed.name }).catch(() => null);
        if (info?.state === 'ACTIVE' && info.uri) return { uri: info.uri, mimeType: info.mimeType || mimeType };
      }
    } catch {}
  }

  onStatus?.(`"${name}" AI'ga oqim bilan yuklanmoqda (${Math.round(size / 1048576)} MB)...`);
  const src = await fetch(blobUrl, { signal: AbortSignal.timeout(280000) });
  if (!src.ok || !src.body) throw new Error(`Faylni o'qib bo'lmadi (${src.status}).`);
  const contentLength = Number(src.headers.get('content-length') || size || 0);

  const startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(contentLength),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: (name || 'fayl').slice(0, 100) } }),
  });
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!startRes.ok || !uploadUrl) throw new Error(`Gemini yuklashni boshlay olmadi (${startRes.status}).`);

  const upRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(contentLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: src.body,
    duplex: 'half',
    signal: AbortSignal.timeout(280000),
  });
  const upJson = await upRes.json().catch(() => null);
  let file = upJson?.file;
  if (!upRes.ok || !file?.name) throw new Error(`Gemini'ga yuklab bo'lmadi (${upRes.status}).`);

  const deadline = Date.now() + 240_000;
  while (file.state === 'PROCESSING' && Date.now() < deadline) {
    onStatus?.('Video Google tomonida qayta ishlanmoqda...');
    await new Promise((r) => setTimeout(r, 3000));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state === 'FAILED') throw new Error('Google faylni qayta ishlay olmadi — mp4 (H.264) formatida urinib ko\'ring.');
  if (file.state !== 'ACTIVE') throw new Error("Fayl hali tayyor emas — birozdan keyin qayta urinib ko'ring.");

  if (redis && cacheKey) {
    redis.set(`tg:gemini-file:${cacheKey}`, JSON.stringify({ name: file.name, uri: file.uri }), { ex: FILE_CACHE_TTL }).catch(() => {});
  }
  return { uri: file.uri, mimeType: file.mimeType || mimeType };
}

async function pdfToText(buffer) {
  try {
    const pdfDoc = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdfDoc, { mergePages: true });
    return (text || '').trim();
  } catch (err) {
    console.error("PDF o'qishda xato:", err);
    return '';
  }
}

/**
 * Faylni Gemini Files API'ga yuklaydi va ACTIVE bo'lguncha kutadi.
 * cacheKey berilsa, natija Redis'da saqlanadi (qayta yuklamaslik uchun).
 */
export async function uploadToGeminiFiles(ai, buffer, { mimeType, name, cacheKey, onStatus }) {
  const redis = getRedis();
  if (redis && cacheKey) {
    try {
      const cached = await redis.get(`tg:gemini-file:${cacheKey}`);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        // Fayl hali yashayotganini tekshiramiz.
        const info = await ai.files.get({ name: parsed.name }).catch(() => null);
        if (info?.state === 'ACTIVE' && info.uri) return { uri: info.uri, mimeType: info.mimeType || mimeType };
      }
    } catch (err) {
      console.error('Gemini fayl keshini o\'qishda xato:', err);
    }
  }

  onStatus?.('Fayl AI\'ga yuklanmoqda...');
  const blob = new Blob([buffer], { type: mimeType });
  let file = await ai.files.upload({ file: blob, config: { mimeType, displayName: (name || 'fayl').slice(0, 100) } });

  // Video/audio Google tomonida qayta ishlanadi (PROCESSING) — tayyor bo'lguncha kutamiz.
  const deadline = Date.now() + 240_000;
  while (file.state === 'PROCESSING' && Date.now() < deadline) {
    onStatus?.('Video qayta ishlanmoqda...');
    await new Promise((r) => setTimeout(r, 2500));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state === 'FAILED') throw new Error('Google faylni qayta ishlay olmadi — boshqa format (mp4) bilan urinib ko\'ring.');
  if (file.state !== 'ACTIVE') throw new Error("Fayl hali tayyor emas — birozdan keyin qayta urinib ko'ring.");

  if (redis && cacheKey) {
    redis
      .set(`tg:gemini-file:${cacheKey}`, JSON.stringify({ name: file.name, uri: file.uri }), { ex: FILE_CACHE_TTL })
      .catch(() => {});
  }
  return { uri: file.uri, mimeType: file.mimeType || mimeType };
}

/**
 * Bitta biriktirmani qayta ishlaydi.
 * @returns {{ parts: Array, textSection: string }}
 */
async function resolveOne(ai, att, onStatus) {
  const name = att.name || 'fayl';
  const category = att.category || classifyFile(name, att.mimeType);
  const mimeType = att.mimeType || 'application/octet-stream';

  // --- Faylni olish (inline base64 yoki Blob) ---
  let buffer;
  if (att.kind === 'blob') {
    // Video/audio yoki katta fayl — xotiraga olmasdan, oqim bilan to'g'ri Gemini'ga.
    const head = await headBlob(att.url);
    const size = head.size || att.size || 0;
    if (category === 'video' || category === 'audio' || size > BUFFER_MAX_BYTES) {
      const f = await streamBlobToGemini(ai, att.url, { mimeType, name, size, cacheKey: att.url, onStatus });
      const type = category === 'video' || category === 'audio' ? category : category === 'image' ? 'image' : 'document';
      return { parts: [{ type, uri: f.uri, mime_type: f.mimeType }], textSection: '' };
    }
    onStatus?.(`"${name}" o'qilmoqda...`);
    buffer = await fetchBlob(att.url);
  } else if (att.data) {
    buffer = Buffer.from(att.data, 'base64');
  } else {
    return { parts: [], textSection: `\n\n(Foydalanuvchi "${name}" faylini biriktirdi, lekin fayl bo'sh keldi.)` };
  }

  const cacheKey = att.kind === 'blob' ? att.url : null;

  if (category === 'image') {
    if (buffer.length <= GEMINI_INLINE_MAX_BYTES) {
      return { parts: [{ type: 'image', data: buffer.toString('base64'), mime_type: mimeType }], textSection: '' };
    }
    const f = await uploadToGeminiFiles(ai, buffer, { mimeType, name, cacheKey, onStatus });
    return { parts: [{ type: 'image', uri: f.uri, mime_type: f.mimeType }], textSection: '' };
  }

  if (category === 'video' || category === 'audio') {
    const f = await uploadToGeminiFiles(ai, buffer, { mimeType, name, cacheKey, onStatus });
    return { parts: [{ type: category, uri: f.uri, mime_type: f.mimeType }], textSection: '' };
  }

  if (category === 'pdf') {
    const text = await pdfToText(buffer);
    // Matni bor PDF — matn sifatida (arzon va ishonchli). Skanerlangan
    // (matnsiz) PDF — hujjat sifatida modelga beriladi, u rasmlarni o'qiydi.
    if (text.length > 400) {
      return { parts: [], textSection: documentSection(name, text) };
    }
    if (buffer.length <= GEMINI_INLINE_MAX_BYTES) {
      return { parts: [{ type: 'document', data: buffer.toString('base64'), mime_type: 'application/pdf' }], textSection: '' };
    }
    const f = await uploadToGeminiFiles(ai, buffer, { mimeType: 'application/pdf', name, cacheKey, onStatus });
    return { parts: [{ type: 'document', uri: f.uri, mime_type: 'application/pdf' }], textSection: '' };
  }

  if (category === 'doc') {
    let extracted = '';
    try {
      extracted = await extractDocumentText(buffer.toString('base64'), name);
    } catch (err) {
      console.error("Hujjatni o'qishda xato:", err);
    }
    return { parts: [], textSection: documentSection(name, extracted) };
  }

  if (category === 'text') {
    return { parts: [], textSection: `\n\n[Fayl: ${name}]\n${buffer.toString('utf8').slice(0, DOCUMENT_TEXT_MAX)}` };
  }

  return {
    parts: [],
    textSection: `\n\n(Foydalanuvchi "${name}" faylini biriktirdi, lekin bu turdagi faylni o'qiy olmayman — faqat nomini bilaman.)`,
  };
}

/**
 * Barcha biriktirmalarni qayta ishlab, AI input'i uchun tayyorlaydi.
 * Xato bo'lsa — o'sha fayl haqida matnli izoh qo'shiladi, qolganlari davom etadi.
 */
export async function resolveAttachments(ai, attachments, { onStatus } = {}) {
  const parts = [];
  let textSection = '';
  for (const att of attachments || []) {
    try {
      const r = await resolveOne(ai, att, onStatus);
      parts.push(...r.parts);
      textSection += r.textSection;
    } catch (err) {
      console.error('Biriktirmani qayta ishlashda xato:', err);
      textSection += `\n\n(Foydalanuvchi "${att?.name || 'fayl'}" faylini biriktirdi, lekin uni o'qib bo'lmadi: ${err.message})`;
    }
  }
  return { parts, textSection };
}

/** Biriktirmalar ichida AI "ko'rishi/eshitishi" kerak bo'lgan media bormi? */
export function defaultPromptFor(attachments) {
  const cats = (attachments || []).map((a) => a.category || classifyFile(a.name, a.mimeType));
  if (cats.includes('video')) return 'Bu videoda nima bo\'layotganini aytib ber.';
  if (cats.includes('audio')) return 'Bu audioda nima aytilganini aytib ber.';
  if (cats.includes('image')) return 'Bu rasmda nima borligini aytib ber.';
  return 'Bu fayldagi mazmunni tushuntirib ber.';
}
