'use client';
 
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// "Bildirishnomalar" — admin yuborgan e'lonlarning tarixi. Push-xabar OS
// darajasida ko'rinib, tez yo'qolib ketishi mumkin — bu yerda hammasi
// doimiy saqlanadi, istalgan vaqt qaytib ko'rish mumkin.
// ============================================================
export default function BildirishnomalarPage() {
  const { status } = useSession();
  const router = useRouter();
 
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => {
        const list = data?.notifications || [];
        setNotifications(list);
        // "Nima yangi" belgisi uchun — oxirgi ko'rilgan bildirishnomani eslab qolamiz.
        if (list[0]?.createdAt) {
          localStorage.setItem('tg-last-seen-notification', list[0].createdAt);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);
 
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
        <h1 className="text-base font-bold">Bildirishnomalar</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-sm px-4 py-8 sm:px-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--tg-text-3)]">
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda...
          </div>
        )}
 
        {!loading && notifications.length === 0 && (
          <p className="text-sm text-[var(--tg-text-3)]">Hozircha bildirishnoma yoʻq.</p>
        )}
 
        {!loading && notifications.length > 0 && (
          <div className="space-y-2">
            {notifications.map((n, i) => (
              <div
                key={`${n.createdAt}-${i}`}
                className="flex gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3.5"
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
                >
                  <Bell size={14} className="text-[#0D0F14]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--tg-text-1)]">{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--tg-text-3)]">{n.message}</p>
                  <p className="mt-1 text-[10px] text-[var(--tg-text-4)]">
                    {new Date(n.createdAt).toLocaleString('uz-UZ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
 