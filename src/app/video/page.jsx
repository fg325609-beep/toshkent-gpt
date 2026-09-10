'use client';
 
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, X, Film, Loader2, Download, Music } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
import { showToast } from '@/lib/toast';
 
// ============================================================
// "Rasmlardan video" — yuklangan rasmlardan slayd-shou video yasaydi.
//
// MUHIM: bu yerda AI ham, server ham, API kalit ham ISHLATILMAYDI.
// Hammasi foydalanuvchining O'Z BRAUZERIDA bajariladi:
//   Canvas'ga rasm chiziladi (sekin yaqinlashish + eritib o'tish effekti bilan)
//   -> canvas.captureStream() jonli video oqimini beradi
//   -> MediaRecorder o'sha oqimni .webm faylga yozadi
// Shu sabab: xarajat nol, kutish yo'q, maxfiylik to'liq (rasm hech qayerga
// yuborilmaydi).
// ============================================================
 
const W = 1080;
const H = 1080;
const FPS = 30;
 
export default function VideoPage() {
  const { status } = useSession();
  const router = useRouter();
 
  const [images, setImages] = useState([]); // { id, url, img }
  const [seconds, setSeconds] = useState(2.5);
  const [audioFile, setAudioFile] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);
 
  const canvasRef = useRef(null);
  const cancelRef = useRef(false);
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  // Brauzer yopilganda/sahifa almashganda yaratilgan vaqtinchalik URL'larni tozalaymiz.
  useEffect(() => {
    return () => {
      images.forEach((it) => URL.revokeObjectURL(it.url));
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 
  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
 
    const loaded = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(file);
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      }).catch(() => null);
      if (img) loaded.push({ id: `${Date.now()}-${loaded.length}`, url, img });
    }
 
    if (!loaded.length) {
      showToast('Rasm yuklab boʻlmadi.', 'error');
      return;
    }
    setImages((prev) => [...prev, ...loaded]);
  }
 
  function removeImage(id) {
    setImages((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.id !== id);
    });
  }
 
  // Rasmni kadr ichiga "to'ldirib" (cover) chizadi — cho'zilib ketmasligi uchun.
  function drawCover(ctx, img, scale) {
    const base = Math.max(W / img.width, H / img.height);
    const s = base * scale;
    const w = img.width * s;
    const h = img.height * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }
 
  async function render() {
    if (images.length === 0) {
      showToast('Avval kamida bitta rasm yuklang.', 'error');
      return;
    }
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
 
    setRendering(true);
    setProgress(0);
    cancelRef.current = false;
 
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(FPS);
 
    // Musiqa qo'shilgan bo'lsa, uni ham yozuvga qo'shamiz (WebAudio orqali).
    let audioEl = null;
    let audioCtx = null;
    if (audioFile) {
      try {
        audioEl = new Audio(URL.createObjectURL(audioFile));
        audioEl.loop = true;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaElementSource(audioEl);
        const dest = audioCtx.createMediaStreamDestination();
        src.connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        await audioEl.play().catch(() => {});
      } catch {
        // Musiqa qo'shilmasa ham video baribir yaratilaveradi.
      }
    }
 
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    };
 
    const done = new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });
 
    recorder.start();
 
    const perImageFrames = Math.round(seconds * FPS);
    const fadeFrames = Math.min(Math.round(0.4 * FPS), Math.floor(perImageFrames / 2));
    const totalFrames = perImageFrames * images.length;
    let frame = 0;
 
    // Kadrlarni real vaqt oqimida chizamiz — MediaRecorder canvas'ni jonli
    // kuzatib turgani uchun, kadrlar orasida haqiqiy pauza bo'lishi shart.
    for (let i = 0; i < images.length && !cancelRef.current; i++) {
      const cur = images[i].img;
      const next = images[i + 1]?.img || null;
 
      for (let f = 0; f < perImageFrames && !cancelRef.current; f++) {
        const t = f / perImageFrames;
        ctx.fillStyle = '#0D0F14';
        ctx.fillRect(0, 0, W, H);
 
        // Ken Burns: sekin yaqinlashish (1.0 -> 1.08)
        ctx.globalAlpha = 1;
        drawCover(ctx, cur, 1 + 0.08 * t);
 
        // Oxirgi kadrlarda keyingi rasmni ustiga sekin "eritib" chiqaramiz.
        if (next && f >= perImageFrames - fadeFrames) {
          const k = (f - (perImageFrames - fadeFrames)) / fadeFrames;
          ctx.globalAlpha = k;
          drawCover(ctx, next, 1);
          ctx.globalAlpha = 1;
        }
 
        frame++;
        setProgress(Math.round((frame / totalFrames) * 100));
        await new Promise((r) => setTimeout(r, 1000 / FPS));
      }
    }
 
    recorder.stop();
    const blob = await done;
 
    if (audioEl) {
      audioEl.pause();
      audioCtx?.close().catch(() => {});
    }
 
    setRendering(false);
    setProgress(100);
 
    if (cancelRef.current) {
      showToast('Bekor qilindi.', 'info');
      return;
    }
    setResultUrl(URL.createObjectURL(blob));
    showToast('Video tayyor! 🎬', 'success');
  }
 
  function downloadResult() {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = 'toshkentgpt-video.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
 
  if (status !== 'authenticated') return null;
 
  const totalDuration = (images.length * seconds).toFixed(1);
 
  return (
    <div className="relative min-h-dvh bg-[var(--tg-bg)] text-[var(--tg-text-1)]">
      <GirihPattern />
 
      <header className="relative z-10 flex items-center gap-3 border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/90 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
        >
          <ArrowLeft size={17} />
        </Link>
        <h1 className="text-base font-bold">Rasmlardan video</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-lg px-4 py-6 sm:px-6">
        <div className="mb-5 flex gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
          <Film size={18} className="mt-0.5 flex-shrink-0 text-[#2F9E96]" />
          <p className="text-xs leading-relaxed text-[var(--tg-text-3)]">
            Rasmlaringizni yuklang — ular musiqa va silliq oʻtish effektlari bilan tayyor videoga aylanadi.
            Hammasi shu qurilmangizda bajariladi, rasmlaringiz hech qayerga yuborilmaydi.
          </p>
        </div>
 
        <label className="mb-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-4 text-sm text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)]">
          <Upload size={16} className="flex-shrink-0 text-[#E4A93B]" />
          <span>Rasmlarni tanlang (bir nechta boʻlishi mumkin)</span>
          <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
        </label>
 
        {images.length > 0 && (
          <div className="mb-4 grid grid-cols-4 gap-2">
            {images.map((it, i) => (
              <div key={it.id} className="relative aspect-square overflow-hidden rounded-lg border border-[var(--tg-border)]">
                <img src={it.url} alt="" className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{i + 1}</span>
                <button
                  onClick={() => removeImage(it.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/60 text-white transition hover:bg-red-500"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
 
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
          Har bir rasm necha soniya: {seconds}s (jami ~{totalDuration}s)
        </label>
        <input
          type="range"
          min="1"
          max="5"
          step="0.5"
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
          className="mb-4 w-full"
        />
 
        <label className="mb-5 flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-3 text-sm text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)]">
          <Music size={16} className="flex-shrink-0 text-[#E4A93B]" />
          <span className="min-w-0 flex-1 truncate">{audioFile ? audioFile.name : 'Musiqa qoʻshish (ixtiyoriy)'}</span>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setAudioFile(f);
            }}
            className="hidden"
          />
        </label>
 
        {rendering ? (
          <>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--tg-border)]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #E4A93B, #2F9E96)' }}
              />
            </div>
            <p className="mb-3 text-center text-xs text-[var(--tg-text-3)]">
              Yaratilmoqda... {progress}% — sahifani yopmang
            </p>
            <button
              onClick={() => {
                cancelRef.current = true;
              }}
              className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
            >
              Bekor qilish
            </button>
          </>
        ) : (
          <button
            onClick={render}
            disabled={images.length === 0}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition hover:opacity-90 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
          >
            <Film size={15} />
            Video yasash
          </button>
        )}
 
        {resultUrl && !rendering && (
          <div className="mt-5">
            <video src={resultUrl} controls className="mb-3 w-full rounded-xl border border-[var(--tg-border)]" />
            <button
              onClick={downloadResult}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--tg-border)] py-2.5 text-sm font-medium text-[var(--tg-text-1)] transition hover:bg-[var(--tg-hover)]"
            >
              <Download size={15} />
              Yuklab olish
            </button>
          </div>
        )}
 
        <canvas ref={canvasRef} width={W} height={H} className="hidden" />
      </main>
    </div>
  );
}
 