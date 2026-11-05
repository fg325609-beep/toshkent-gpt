import { auth } from '@/auth';

// ============================================================
// Tayyor klip fayllarini worker'dan foydalanuvchiga oqim (stream) qilib
// uzatadi. Range so'rovlari (video'ni oldinga surish) ham o'tkaziladi.
// ============================================================

export const maxDuration = 300;

export async function GET(req, { params }) {
  const session = await auth();
  if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });

  const { jobId, name } = await params;
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(jobId) || !/^[a-zA-Z0-9_.-]{1,120}$/.test(name) || name.includes('..')) {
    return new Response('Bad request', { status: 400 });
  }
  const base = (process.env.LOCAL_VIDEO_URL || '').replace(/\/$/, '');
  if (!base) return new Response('Worker not configured', { status: 503 });

  const headers = {};
  const range = req.headers.get('range');
  if (range) headers.Range = range;

  let upstream;
  try {
    upstream = await fetch(`${base}/clips/file/${jobId}/${encodeURIComponent(name)}`, { headers, signal: AbortSignal.timeout(290000) });
  } catch {
    return new Response('Worker unreachable', { status: 503 });
  }
  if (!upstream.ok && upstream.status !== 206) return new Response('Not found', { status: upstream.status || 404 });

  const out = new Headers();
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  if (!out.has('content-type')) out.set('content-type', name.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4');
  out.set('cache-control', 'private, max-age=3600');
  if (req.nextUrl?.searchParams?.get('download') === '1' || new URL(req.url).searchParams.get('download') === '1') {
    out.set('content-disposition', `attachment; filename="${name}"`);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
