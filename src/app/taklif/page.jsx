'use client';
 
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, Send, Gift, Loader2, Users } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// "Do'stlarni taklif qilish" — har bir foydalanuvchining shaxsiy taklif
// havolasi, uni ulashish tugmalari, va nechta do'st taklif qilgani.
// ============================================================
export default function TaklifPage() {
  const { status } = useSession();
  const router = useRouter();
 
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/referral')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [status]);
 
  async function copyLink() {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = data.link;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
 
  function shareToTelegram() {
    if (!data?.link) return;
    const text = "ToshkentGPT — koʻcha tilida gaplashadigan AI yordamchi. Mening havolam orqali kirsang, ikkalamiz ham bonus olamiz! 🎁";
    window.open(`https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent(text)}`, '_blank');
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
        <h1 className="text-base font-bold">Doʻstlarni taklif qiling</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-sm px-4 py-8 sm:px-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--tg-text-3)]">
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
          </div>
        )}
 
        {!loading && !data?.link && (
          <p className="text-sm text-red-400">Havolani yuklab boʻlmadi. Birozdan keyin qayta urinib koʻring.</p>
        )}
 
        {!loading && data?.link && (
          <>
            <div className="mb-6 flex flex-col items-center rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-6 text-center">
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
              >
                <Gift size={22} className="text-[#0D0F14]" />
              </div>
              <h2 className="text-sm font-bold">Ikkalangiz ham bonus olasiz!</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--tg-text-3)]">
                Havolangiz orqali doʻstingiz roʻyxatdan oʻtsa, ikkalangiz ham <b>2 kunlik Pro tarif</b> (kuniga 60
                xabar) sovgʻa olasiz — bepul.
              </p>
            </div>
 
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
              Sizning shaxsiy havolangiz
            </p>
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-2 pl-3">
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--tg-text-2)]">{data.link}</span>
              <button
                onClick={copyLink}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--tg-hover)] text-[var(--tg-text-2)] transition hover:text-[var(--tg-text-1)]"
              >
                {copied ? <Check size={14} className="text-[#2F9E96]" /> : <Copy size={14} />}
              </button>
            </div>
 
            <button
              onClick={shareToTelegram}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              <Send size={15} />
              Telegram orqali ulashish
            </button>
 
            <div className="flex items-center justify-between rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-[var(--tg-text-2)]">
                <Users size={14} />
                Taklif qilingan doʻstlar
              </div>
              <span className="text-lg font-bold text-[#E4A93B]">{data.count}</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
 