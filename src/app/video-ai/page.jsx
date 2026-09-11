'use client';
 
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Sparkles, Loader2, Download, X, Info } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
import { fileToDataUrl } from '@/lib/files';
import { showToast } from '@/lib/toast';
 
// ============================================================
// "AI video" — bitta surat + tavsif berilsa, uni JONLANTIRADI.
//
// Ishlash tartibi (Vercel 60s cheklovi tufayli 2 bosqichli):
//   1) POST /api/video-ai   -> so'rov navbatga qo'yiladi, requestId qaytadi
//   2) har 5 soniyada GET /api/video-ai?requestId=... -> tayyor bo'lguncha
// ============================================================
export default function VideoAiPage() {
  const { status } = useSession();
  const router = useRouter();
 
  const [image, setImage] = useState(null); // { dataUrl, name }
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState('5');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
 
  const pollRef = useRef(null);
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  // Sahifadan chiqilganda tekshiruv siklini to'xtatamiz.
  useEffect(() => () => clearInterval(pollRef.current), []);
 
  async function pickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 6_000_000) {
      showToast('Rasm juda katta (6 MB dan kichik boʻlsin).', 'error');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setImage({ dataUrl, name: file.name });
    setVideoUrl(null);
  }
 
  async function generate() {
    if (!image) {
      showToast('Avval rasm yuklang.', 'error');
      return;
    }
    setBusy(true);
    setVideoUrl(null);
    setStage('Soʻrov yuborilmoqda...');
 
    try {
      const res = await fetch('/api/video-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: image.dataUrl, prompt, duration }),
      });
      const data = await res.json().catch(() => null);
 
      if (!res.ok) {
        if (data?.requiresUpgrade) {
          showToast(data.error, 'error', 6000);
          router.push('/tariflar');
          return;
        }
        throw new Error(data?.error || 'Xatolik yuz berdi.');
      }
 
      setStage('Video yaratilmoqda... (1-5 daqiqa)');
 
      // Tayyor bo'lguncha har 5 soniyada tekshiramiz.
      const query = `requestId=${encodeURIComponent(data.requestId)}&model=${encodeURIComponent(data.model)}`;
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/video-ai?${query}`);
          const s = await r.json().catch(() => null);
 
          if (s?.state === 'done') {
            clearInterval(pollRef.current);
            setVideoUrl(s.videoUrl);
            setBusy(false);
            setStage('');
            showToast('Video tayyor! 🎬', 'success');
          } else if (s?.state === 'error') {
            clearInterval(pollRef.current);
            setBusy(false);
            setStage('');
            showToast(s.message || 'Video yaratishda xatolik.', 'error');
          }
        } catch {
          // Vaqtinchalik tarmoq uzilishi — keyingi tekshiruvda davom etamiz.
        }
      }, 5000);
    } catch (err) {
      setBusy(false);
      setStage('');
      showToast(err.message, 'error');
    }
  }
 
  if (status !== 'authenticated') return null;
 
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
        <h1 className="text-base font-bold">AI video</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-lg px-4 py-6 sm:px-6">
        <div className="mb-5 flex gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-[#E4A93B]" />
          <p className="text-xs leading-relaxed text-[var(--tg-text-3)]">
            Suratni yuklang va nima harakat boʻlishini yozing — AI uni jonlantiradi. Bu funksiya faqat{' '}
            <b>Max</b> va <b>Pro Max</b> tariflarida ishlaydi.
          </p>
        </div>
 
        {image ? (
          <div className="relative mb-4 overflow-hidden rounded-xl border border-[var(--tg-border)]">
            <img src={image.dataUrl} alt="" className="max-h-72 w-full object-contain bg-black/20" />
            <button
              onClick={() => setImage(null)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white transition hover:bg-red-500"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="mb-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-5 text-sm text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)]">
            <Upload size={16} className="flex-shrink-0 text-[#E4A93B]" />
            <span>Suratni tanlang (6 MB gacha)</span>
            <input type="file" accept="image/*" onChange={pickImage} className="hidden" />
          </label>
        )}
 
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
          Qanday harakat boʻlsin?
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Masalan: kamera sekin yaqinlashadi, shamol sochlarini uchiradi"
          className="mb-4 w-full resize-none rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-2.5 text-sm text-[var(--tg-text-1)] placeholder-[var(--tg-text-4)] outline-none focus:border-[var(--tg-border-strong)]"
        />
 
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
          Davomiyligi
        </label>
        <div className="mb-5 flex gap-2">
          {['5', '10'].map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`flex-1 rounded-xl border py-2 text-xs font-medium transition ${
                duration === d
                  ? 'border-[#2F9E96] bg-[#2F9E96]/10 text-[#2F9E96]'
                  : 'border-[var(--tg-border)] text-[var(--tg-text-2)] hover:bg-[var(--tg-hover)]'
              }`}
            >
              {d} soniya
            </button>
          ))}
        </div>
 
        <button
          onClick={generate}
          disabled={busy || !image}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition hover:opacity-90 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? 'Yaratilmoqda...' : 'Video yasash'}
        </button>
 
        {busy && stage && (
          <p className="mt-3 text-center text-xs text-[var(--tg-text-3)]">
            {stage} — sahifani yopmang
          </p>
        )}
 
        {videoUrl && !busy && (
          <div className="mt-6">
            <video src={videoUrl} controls className="mb-3 w-full rounded-xl border border-[var(--tg-border)]" />
            <a
              href={videoUrl}
              download="toshkentgpt-ai-video.mp4"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--tg-border)] py-2.5 text-sm font-medium text-[var(--tg-text-1)] transition hover:bg-[var(--tg-hover)]"
            >
              <Download size={15} />
              Yuklab olish
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
 