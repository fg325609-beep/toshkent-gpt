'use client';
 
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// "Men haqimda nima bilasan?" — shaffoflik sahifasi. ToshkentGPT suhbat
// davomida ["[[ESLA: kalit=qiymat]]"] orqali o'rganib olgan faktlarni
// (ism, qiziqishlar va h.k.) shu yerda ko'rish va xohlasa o'chirish mumkin.
// ============================================================
 
const LABELS = {
  ism: 'Ism',
  familiya: 'Familiya',
  til: 'Bot tili',
};
 
const LANGUAGE_LABELS = { auto: 'Avtomatik', uz: "Oʻzbekcha", ru: 'Ruscha', en: 'Inglizcha' };
 
// Bular ichki texnik belgilar — foydalanuvchiga "fakt" sifatida ko'rsatilmaydi.
const HIDDEN_KEYS = new Set(['onboarded']);
 
function labelFor(key) {
  return LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}
 
function displayValue(key, value) {
  if (key === 'til') return LANGUAGE_LABELS[value] || value;
  return String(value);
}
 
export default function MeningMalumotlarimPage() {
  const { status } = useSession();
  const router = useRouter();
 
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => setProfile(data || {}))
      .catch(() => setProfile({}))
      .finally(() => setLoading(false));
  }, [status]);
 
  async function deleteFact(key) {
    setDeletingKey(key);
    try {
      await fetch('/api/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      setProfile((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setDeletingKey(null);
    }
  }
 
  async function clearAll() {
    if (!confirm("Haqingizdagi BARCHA maʼlumotlarni oʻchirishni xohlaysizmi? Bu qaytarib bo'lmaydi.")) return;
    setClearingAll(true);
    try {
      await fetch('/api/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setProfile({});
    } finally {
      setClearingAll(false);
    }
  }
 
  if (status !== 'authenticated') return null;
 
  const entries = Object.entries(profile || {}).filter(([key, value]) => !HIDDEN_KEYS.has(key) && value);
 
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
        <h1 className="text-base font-bold">Men haqimda nima bilasan?</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-sm px-4 py-8 sm:px-6">
        <div className="mb-6 flex gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
          <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-[#2F9E96]" />
          <p className="text-xs leading-relaxed text-[var(--tg-text-3)]">
            Suhbat davomida siz aytgan baʼzi shaxsiy narsalarni (ism, qiziqishlar va h.k.) eslab qolaman —
            shunda har safar qaytadan tanishishimiz shart boʻlmaydi. Bu yerda nimalarni bilishimni koʻrasiz va
            xohlagan vaqt oʻchirib tashlashingiz mumkin.
          </p>
        </div>
 
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--tg-text-3)]">
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
          </div>
        )}
 
        {!loading && entries.length === 0 && (
          <p className="text-sm text-[var(--tg-text-3)]">
            Hozircha siz haqingizda hech narsa bilmayman — suhbatlashgan sari oʻrganib boraman 🙂
          </p>
        )}
 
        {!loading && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">{labelFor(key)}</p>
                  <p className="truncate text-sm text-[var(--tg-text-1)]">{displayValue(key, value)}</p>
                </div>
                <button
                  onClick={() => deleteFact(key)}
                  disabled={deletingKey === key}
                  title="O'chirish"
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--tg-text-3)] transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  {deletingKey === key ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
 
        {!loading && entries.length > 0 && (
          <button
            onClick={clearAll}
            disabled={clearingAll}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {clearingAll ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Barchasini oʻchirish
          </button>
        )}
      </main>
    </div>
  );
}
 