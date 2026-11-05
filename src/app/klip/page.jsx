'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  X,
  Link2,
  Loader2,
  Download,
  Sparkles,
  Scissors,
  Captions,
  Info,
  Copy,
  Check,
  Clock,
  Film,
  Music,
  Plus,
} from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
import { showToast } from '@/lib/toast';
import { prepareAttachment } from '@/lib/upload';
import { formatBytes, MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

// ============================================================
// PODKAST → KLIP studiyasi.
//
// Uzun podkast/video (fayl yoki YouTube havolasi) → lokal worker:
//   1) yuklab olish  2) Whisper transkripsiya  3) Gemini eng kuchli "hook"
//   momentlarni tanlaydi  4) ffmpeg: kesish, 9:16, so'zma-so'z subtitr,
//   hook sarlavha, brend/pul izohlari  → tayyor kliplar shu yerda.
//
// Vazifa holati localStorage'da saqlanadi — sahifa yangilansa ham davom etadi.
// ============================================================

const JOB_KEY = 'tg-klip-job';
const LENGTHS = [
  { v: 30, label: '30 s' },
  { v: 60, label: '60 s' },
  { v: 90, label: '90 s' },
  { v: 120, label: '2 daqiqa' },
];
const ASPECTS = [
  { v: '9:16', label: '9:16', hint: 'Reels, Shorts, TikTok' },
  { v: '1:1', label: '1:1', hint: 'Instagram post' },
  { v: '16:9', label: '16:9', hint: 'YouTube' },
];
const LANGS = [
  { v: 'auto', label: 'Avto' },
  { v: 'uz', label: "O'zbek" },
  { v: 'ru', label: 'Rus' },
  { v: 'en', label: 'Ingliz' },
];

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">{label}</label>
        {hint && <span className="text-[11px] text-[var(--tg-text-4)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
        active
          ? 'border-[var(--tg-teal)] bg-[var(--tg-teal)]/10 text-[var(--tg-teal)]'
          : 'border-[var(--tg-border)] text-[var(--tg-text-2)] hover:bg-[var(--tg-hover)]'
      }`}
    >
      {children}
    </button>
  );
}

function ClipCard({ clip, index }) {
  const [copied, setCopied] = useState(false);
  async function copyHook() {
    try {
      await navigator.clipboard.writeText(`${clip.title ? `${clip.title}\n\n` : ''}${clip.hook || ''}`.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="tg-rise overflow-hidden rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)]" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="bg-black/40">
        <video src={clip.url} poster={clip.thumbnailUrl || undefined} controls preload="metadata" playsInline className="mx-auto max-h-[460px] w-full" />
      </div>
      <div className="p-3.5">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--tg-text-4)]">
          <span className="rounded-md bg-[var(--tg-hover)] px-1.5 py-0.5 font-medium text-[var(--tg-text-2)]">#{clip.index || index + 1}</span>
          <Clock size={11} />
          {fmtTime(clip.start)} – {fmtTime(clip.end)} · {fmtTime(clip.duration)}
          {clip.removed_pause_seconds > 0 && (
            <span className="rounded-md bg-[var(--tg-teal)]/12 px-1.5 py-0.5 text-[var(--tg-teal)]" title="Pauzalar olib tashlandi">
              −{Math.round(clip.removed_pause_seconds)}s pauza
            </span>
          )}
        </div>
        {clip.title && <h3 className="text-[15px] font-bold leading-snug text-[var(--tg-text-1)]">{clip.title}</h3>}
        {clip.hook && <p className="mt-1 text-[13px] leading-relaxed text-[var(--tg-text-2)]">“{clip.hook}”</p>}
        {clip.reason && <p className="mt-1.5 text-[11.5px] text-[var(--tg-text-4)]">{clip.reason}</p>}
        <div className="mt-3 flex gap-2">
          <a
            href={`${clip.url}?download=1`}
            download={clip.filename || `klip_${index + 1}.mp4`}
            className="tg-sendbtn flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-[#0D0F14]"
          >
            <Download size={14} />
            Yuklab olish
          </a>
          <button
            type="button"
            onClick={copyHook}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--tg-border)] px-3 py-2 text-xs font-medium text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
            title="Sarlavha va hook matnini nusxalash (post uchun)"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            Matn
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KlipPage() {
  const { data: authData, status } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState('file'); // file | link
  const [file, setFile] = useState(null); // { name, size, url, category }
  const [uploadPct, setUploadPct] = useState(null);
  const [link, setLink] = useState('');

  const [clipCount, setClipCount] = useState(0); // 0 = avtomatik (podkast uzunligiga qarab)
  const [removePauses, setRemovePauses] = useState(true);
  const [smartCrop, setSmartCrop] = useState(true);
  const [quality, setQuality] = useState('high');
  const [maxLen, setMaxLen] = useState(120);
  const [aspect, setAspect] = useState('9:16');
  const [subtitles, setSubtitles] = useState(true);
  const [language, setLanguage] = useState('auto');
  const [brandTerms, setBrandTerms] = useState([]);
  const [brandInput, setBrandInput] = useState('');
  const [instructions, setInstructions] = useState('');

  const [job, setJob] = useState(null); // { requestId, startedAt }
  const [jobState, setJobState] = useState(null); // worker status
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);
  const dropRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  // Avvalgi vazifa bo'lsa — davom etamiz.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(JOB_KEY) || 'null');
      if (saved?.requestId && Date.now() - (saved.startedAt || 0) < 24 * 3600 * 1000) {
        setJob(saved);
        setBusy(true);
      }
    } catch {}
  }, []);

  // Holatni har 4 soniyada so'raymiz.
  useEffect(() => {
    if (!job?.requestId) return;
    let stopped = false;
    async function tick() {
      try {
        const r = await fetch(`/api/clips?requestId=${encodeURIComponent(job.requestId)}`);
        const s = await r.json().catch(() => null);
        if (stopped || !s) return;
        setJobState(s);
        if (s.state === 'done' || s.state === 'error') {
          clearInterval(pollRef.current);
          setBusy(false);
          if (s.state === 'done') showToast(`${s.clips?.length || 0} ta klip tayyor! 🎬`, 'success');
          else showToast(s.message || 'Klip yaratishda xatolik.', 'error', 6000);
        }
      } catch {}
    }
    tick();
    pollRef.current = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(pollRef.current);
    };
  }, [job?.requestId]);

  async function handleFile(f) {
    if (!f) return;
    if (!/^(video|audio)\//.test(f.type) && !/\.(mp4|mov|webm|mkv|m4a|mp3|wav|ogg|aac)$/i.test(f.name)) {
      showToast('Video yoki audio fayl tanlang.', 'error');
      return;
    }
    setUploadPct(0);
    try {
      const att = await prepareAttachment(f, { email: authData?.user?.email, onProgress: setUploadPct });
      if (att.kind !== 'blob' || !att.url) {
        // Worker'ga faylning HAVOLASI kerak — video/audio har doim Blob'ga yuklanadi.
        throw new Error("Faylni yuklab bo'lmadi — Vercel Blob sozlanganini tekshiring.");
      }
      setFile({ name: att.name, size: att.size, url: att.url, category: att.category });
    } catch (err) {
      showToast(err.message, 'error', 7000);
    } finally {
      setUploadPct(null);
    }
  }

  function addBrand() {
    const t = brandInput.trim();
    if (!t) return;
    if (!brandTerms.includes(t) && brandTerms.length < 20) setBrandTerms((p) => [...p, t]);
    setBrandInput('');
  }

  async function start() {
    const sourceUrl = mode === 'file' ? file?.url : link.trim();
    if (!sourceUrl) {
      showToast(mode === 'file' ? 'Avval faylni yuklang.' : 'Havolani kiriting.', 'error');
      return;
    }
    setBusy(true);
    setJobState(null);
    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl, clipCount, maxClipSeconds: maxLen, aspect, subtitles, language, brandTerms, instructions, removePauses, smartCrop, quality }),
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
      const j = { requestId: data.requestId, startedAt: Date.now() };
      localStorage.setItem(JOB_KEY, JSON.stringify(j));
      setJob(j);
    } catch (err) {
      setBusy(false);
      showToast(err.message, 'error', 7000);
    }
  }

  function reset() {
    clearInterval(pollRef.current);
    localStorage.removeItem(JOB_KEY);
    setJob(null);
    setJobState(null);
    setBusy(false);
  }

  if (status !== 'authenticated') return null;

  const progress = Math.min(100, Math.max(0, Number(jobState?.progress) || 0));
  const done = jobState?.state === 'done';
  const failed = jobState?.state === 'error';

  return (
    <div className="relative min-h-dvh bg-[var(--tg-bg)] text-[var(--tg-text-1)]">
      <GirihPattern />

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/85 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
        >
          <ArrowLeft size={17} />
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-bold">
            <Scissors size={16} className="text-[var(--tg-teal)]" />
            Podkast → klip
          </h1>
          <p className="truncate text-[11px] text-[var(--tg-text-4)]">Uzun videodan hookʼli, subtitrli, tayyor kliplar</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {!job && (
          <>
            <div className="mb-5 flex gap-3 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3.5">
              <Info size={18} className="mt-0.5 flex-shrink-0 text-[var(--tg-gold)]" />
              <p className="text-xs leading-relaxed text-[var(--tg-text-3)]">
                Podkast yoki uzun videoni bering — AI eng kuchli momentlarni (hook) topadi, {maxLen >= 120 ? '2 daqiqagacha' : `${maxLen} soniyagacha`}{' '}
                kesadi, soʼzma-soʼz subtitr qoʼyadi, brend va pul summalari aytilganda izoh chiqaradi. Montaj egasining kompyuteridagi workerʼda
                bajariladi — <b>Max</b> va <b>Pro Max</b> tariflarida.
              </p>
            </div>

            {/* Manba */}
            <div className="mb-4 flex gap-1 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-1">
              {[
                { v: 'file', label: 'Fayl yuklash', icon: Upload },
                { v: 'link', label: 'Havola (YouTube va h.k.)', icon: Link2 },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => setMode(t.v)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition ${
                      mode === t.v ? 'bg-[var(--tg-surface)] text-[var(--tg-text-1)] shadow-sm' : 'text-[var(--tg-text-3)] hover:text-[var(--tg-text-1)]'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {mode === 'file' ? (
              file ? (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--tg-teal)]/15 text-[var(--tg-teal)]">
                    {file.category === 'audio' ? <Music size={18} /> : <Film size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-[11px] text-[var(--tg-text-4)]">{formatBytes(file.size)} · yuklandi</p>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="tg-iconbtn" title="Olib tashlash">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <label
                  ref={dropRef}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-9 text-center transition ${
                    dragOver ? 'border-[var(--tg-gold)] bg-[var(--tg-gold)]/5' : 'border-[var(--tg-border)] bg-[var(--tg-surface)] hover:border-[var(--tg-border-strong)]'
                  }`}
                >
                  {uploadPct !== null ? (
                    <>
                      <Loader2 size={22} className="animate-spin text-[var(--tg-gold)]" />
                      <p className="text-sm font-medium">Yuklanmoqda… {uploadPct}%</p>
                      <div className="mt-1 h-1.5 w-56 overflow-hidden rounded-full bg-[var(--tg-hover)]">
                        <div className="h-full rounded-full" style={{ width: `${uploadPct}%`, background: 'linear-gradient(90deg, var(--tg-gold), var(--tg-teal))' }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--tg-gold)]/12 text-[var(--tg-gold)]">
                        <Upload size={20} />
                      </span>
                      <p className="text-sm font-medium">Podkast video/audiosini tashlang yoki tanlang</p>
                      <p className="text-[11.5px] text-[var(--tg-text-4)]">MP4, MOV, MP3, M4A… — {(MAX_UPLOAD_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB gacha, necha soatlik boʻlsa ham</p>
                    </>
                  )}
                  <input type="file" accept="video/*,audio/*" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" disabled={uploadPct !== null} />
                </label>
              )
            ) : (
              <div className="mb-4">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="w-full rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-2.5 text-sm text-[var(--tg-text-1)] placeholder-[var(--tg-text-4)] outline-none focus:border-[var(--tg-border-strong)]"
                />
                <p className="mt-1.5 text-[11px] text-[var(--tg-text-4)]">YouTube, Instagram, TikTok havolasi yoki toʼgʼridan-toʼgʼri .mp4/.mp3 havola.</p>
              </div>
            )}

            <div className="grid gap-x-5 sm:grid-cols-2">
              <Field label="Nechta klip" hint={clipCount === 0 ? 'avtomatik' : `${clipCount} ta`}>
                <input type="range" min={0} max={8} value={clipCount} onChange={(e) => setClipCount(Number(e.target.value))} className="w-full accent-[var(--tg-teal)]" />
                <p className="mt-1 text-[11px] text-[var(--tg-text-4)]">
                  {clipCount === 0 ? 'AI podkast uzunligiga qarab oʻzi tanlaydi (har ~8 daqiqaga 1 ta, 2–8)' : 'Chapga surib «avtomatik» qilsa ham boʻladi'}
                </p>
              </Field>
              <Field label="Maksimal uzunlik">
                <div className="flex flex-wrap gap-1.5">
                  {LENGTHS.map((l) => (
                    <Chip key={l.v} active={maxLen === l.v} onClick={() => setMaxLen(l.v)}>
                      {l.label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Format">
                <div className="flex flex-wrap gap-1.5">
                  {ASPECTS.map((a) => (
                    <Chip key={a.v} active={aspect === a.v} onClick={() => setAspect(a.v)} title={a.hint}>
                      {a.label} <span className="font-normal opacity-70">· {a.hint}</span>
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Nutq tili">
                <div className="flex flex-wrap gap-1.5">
                  {LANGS.map((l) => (
                    <Chip key={l.v} active={language === l.v} onClick={() => setLanguage(l.v)}>
                      {l.label}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Aqlli montaj">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { on: removePauses, set: setRemovePauses, title: 'Pauzalarni olib tashlash', hint: 'Uzun jimliklar kesiladi — klip zich va dinamik (jump-cut)' },
                  { on: smartCrop, set: setSmartCrop, title: 'Yuzga qarab kadrlash', hint: '9:16 / 1:1 da kamera soʻzlovchi yuziga markazlanadi; ikki kishi — boʻlingan ekran' },
                ].map((o) => (
                  <button
                    key={o.title}
                    type="button"
                    onClick={() => o.set((v) => !v)}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                      o.on ? 'border-[var(--tg-teal)]/50 bg-[var(--tg-teal)]/8' : 'border-[var(--tg-border)]'
                    }`}
                  >
                    <span className="flex-1">
                      <span className="block font-medium">{o.title}</span>
                      <span className="block text-[11.5px] text-[var(--tg-text-4)]">{o.hint}</span>
                    </span>
                    <span className={`h-5 w-9 flex-shrink-0 rounded-full p-0.5 transition ${o.on ? 'bg-[var(--tg-teal)]' : 'bg-[var(--tg-border-strong)]'}`}>
                      <span className={`block h-4 w-4 rounded-full bg-white transition ${o.on ? 'translate-x-4' : ''}`} />
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Sifat" hint="NVIDIA bo'lsa tezroq">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { v: 'fast', label: 'Tez', hint: 'oldindan koʻrish' },
                  { v: 'high', label: 'Yuqori', hint: 'tavsiya' },
                  { v: 'max', label: 'Maksimal', hint: 'eng tiniq, sekinroq' },
                ].map((qq) => (
                  <Chip key={qq.v} active={quality === qq.v} onClick={() => setQuality(qq.v)}>
                    {qq.label} <span className="font-normal opacity-70">· {qq.hint}</span>
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Subtitr">
              <button
                type="button"
                onClick={() => setSubtitles((v) => !v)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                  subtitles ? 'border-[var(--tg-teal)]/50 bg-[var(--tg-teal)]/8' : 'border-[var(--tg-border)]'
                }`}
              >
                <Captions size={16} className={subtitles ? 'text-[var(--tg-teal)]' : 'text-[var(--tg-text-4)]'} />
                <span className="flex-1">
                  <span className="block font-medium">Soʼzma-soʼz subtitr</span>
                  <span className="block text-[11.5px] text-[var(--tg-text-4)]">Aytilgan soʼzlar bilan bir xil, aytilayotgan soʼz oltin rangda</span>
                </span>
                <span className={`h-5 w-9 rounded-full p-0.5 transition ${subtitles ? 'bg-[var(--tg-teal)]' : 'bg-[var(--tg-border-strong)]'}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition ${subtitles ? 'translate-x-4' : ''}`} />
                </span>
              </button>
            </Field>

            <Field label="Brend / pul izohlari" hint="aytilganda ekranda chiqadi">
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-2">
                {brandTerms.map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-lg bg-[var(--tg-teal)]/12 px-2 py-1 text-xs text-[var(--tg-teal)]">
                    {t}
                    <button type="button" onClick={() => setBrandTerms((p) => p.filter((x) => x !== t))} aria-label="Olib tashlash">
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addBrand();
                    }
                  }}
                  onBlur={addBrand}
                  placeholder={brandTerms.length ? '' : 'Masalan: InFran, 50 000 dollar, Toshkent — Enter'}
                  className="min-w-[160px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder-[var(--tg-text-4)]"
                />
                <button type="button" onClick={addBrand} className="tg-iconbtn h-7 w-7" title="Qo'shish">
                  <Plus size={14} />
                </button>
              </div>
            </Field>

            <Field label="AI'ga ko'rsatma" hint="ixtiyoriy">
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                placeholder="Masalan: franshiza va pul haqidagi momentlarni ol, hazil joylarni ham qo'sh, mehmonning gaplari ustuvor"
                className="w-full resize-none rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-2.5 text-sm text-[var(--tg-text-1)] placeholder-[var(--tg-text-4)] outline-none focus:border-[var(--tg-border-strong)]"
              />
            </Field>

            <button
              type="button"
              onClick={start}
              disabled={busy || uploadPct !== null || (mode === 'file' ? !file : !link.trim())}
              className="tg-sendbtn flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[#0D0F14] transition disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {busy ? 'Yuborilmoqda…' : clipCount === 0 ? 'Kliplarni yasash (avtomatik)' : `${clipCount} ta klip yasash`}
            </button>
          </>
        )}

        {job && (
          <div className="tg-fade-in">
            {!done && !failed && (
              <div className="rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-5">
                <div className="mb-3 flex items-center gap-3">
                  <Loader2 size={22} className="animate-spin text-[var(--tg-gold)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{jobState?.stage || 'Worker bilan bog\'lanilmoqda…'}</p>
                    <p className="text-[11.5px] text-[var(--tg-text-4)]">
                      {jobState?.message || 'Uzun video bo\'lsa 5–20 daqiqa olishi mumkin. Sahifani yopsangiz ham davom etadi — keyin qaytib tekshiring.'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[var(--tg-text-2)]">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--tg-hover)]">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(3, progress)}%`, background: 'linear-gradient(90deg, var(--tg-gold), var(--tg-teal))' }} />
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={reset} className="text-xs text-[var(--tg-text-4)] underline-offset-2 hover:underline">
                    Bekor qilish va yangisini boshlash
                  </button>
                </div>
              </div>
            )}

            {failed && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/8 p-5">
                <p className="text-sm font-semibold text-red-400">Klip yaratib boʼlmadi</p>
                <p className="mt-1 text-xs text-[var(--tg-text-3)]">{jobState?.message || 'Noma\'lum xato.'}</p>
                <button type="button" onClick={reset} className="mt-4 rounded-xl border border-[var(--tg-border)] px-4 py-2 text-xs font-medium transition hover:bg-[var(--tg-hover)]">
                  Qayta urinish
                </button>
              </div>
            )}

            {done && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">{jobState.clips?.length || 0} ta klip tayyor 🎬</h2>
                    {jobState.duration ? <p className="text-[11.5px] text-[var(--tg-text-4)]">Manba: {fmtTime(jobState.duration)} daqiqa</p> : null}
                  </div>
                  <button type="button" onClick={reset} className="rounded-xl border border-[var(--tg-border)] px-3.5 py-2 text-xs font-medium transition hover:bg-[var(--tg-hover)]">
                    Yangi podkast
                  </button>
                </div>
                <div className={`grid gap-4 ${aspect === '9:16' ? 'sm:grid-cols-2' : ''}`}>
                  {(jobState.clips || []).map((c, i) => (
                    <ClipCard key={c.filename || i} clip={c} index={i} />
                  ))}
                </div>
                {Array.isArray(jobState.warnings) && jobState.warnings.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[var(--tg-gold)]/30 bg-[var(--tg-gold)]/8 p-4 text-[12.5px] text-[var(--tg-text-2)]">
                    <p className="mb-1 font-semibold text-[var(--tg-gold)]">Eslatmalar</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {jobState.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {jobState.transcript_preview && (
                  <details className="mt-5 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
                    <summary className="cursor-pointer text-xs font-medium text-[var(--tg-text-2)]">Transkript (boshlanishi)</summary>
                    <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[var(--tg-text-3)]">{jobState.transcript_preview}</p>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
