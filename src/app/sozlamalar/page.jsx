'use client';
 
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Sun,
  Moon,
  Languages,
  Send,
  Bell,
  History,
  BrainCircuit,
  GraduationCap,
  Gift,
  Info,
  Users,
  HelpCircle,
  MessageSquare,
  ShieldCheck,
  FileCheck,
  Sparkles,
  LogOut,
  ChevronRight,
  Loader2,
  Download,
  FolderOpen,
} from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
import { useTheme } from '@/app/use-theme';
import { showToast } from '@/lib/toast';
import { isPushSupported, subscribeToPush, getCurrentPushSubscription } from '@/lib/push';
import { APP_VERSION } from '@/lib/version';
import { PLANS } from '@/app/plans';
import { storageKey, loadJSON } from '@/lib/storage';
 
const LANGUAGES = [
  { code: 'auto', label: 'Avto' },
  { code: 'uz', label: 'UZ' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
];
 
// ============================================================
// Sozlamalar — endi ALOHIDA, TARTIBLI sahifa (avval hammasi bitta
// ochiladigan menyuda edi, 16+ band bilan chalkash bo'lib qolgan edi).
// Har bir bo'lim mavzu bo'yicha guruhlangan: Hisob, Ko'rinish, Ulanishlar,
// Ma'lumot, Huquqiy.
// ============================================================
 
function SectionLabel({ children }) {
  return <p className="mb-1.5 mt-6 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tg-text-4)]">{children}</p>;
}
 
function Row({ icon: Icon, label, href, onClick, right, danger }) {
  const className = `flex w-full items-center gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-4 py-3 text-left text-sm transition hover:bg-[var(--tg-hover)] ${
    danger ? 'text-red-400' : 'text-[var(--tg-text-1)]'
  }`;
  const content = (
    <>
      <Icon size={17} className="flex-shrink-0" />
      <span className="min-w-0 flex-1">{label}</span>
      {right !== undefined ? right : <ChevronRight size={15} className="flex-shrink-0 text-[var(--tg-text-4)]" />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
 
function Toggle({ on }) {
  return (
    <span className={`h-5 w-9 flex-shrink-0 rounded-full transition ${on ? 'bg-[#2F9E96]' : 'bg-[var(--tg-border-strong)]'}`}>
      <span className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </span>
  );
}
 
export default function SozlamalarPage() {
  const { status, data: authData } = useSession();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
 
  const [profile, setProfile] = useState(null);
  const [planId, setPlanId] = useState('lite');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/profile').then((r) => r.json()).then(setProfile).catch(() => setProfile({}));
    fetch('/api/plan').then((r) => (r.ok ? r.json() : null)).then((p) => p?.id && setPlanId(p.id)).catch(() => {});
    if (isPushSupported()) {
      getCurrentPushSubscription().then((sub) => setPushEnabled(Boolean(sub)));
    }
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => {
        const latest = data?.notifications?.[0];
        if (!latest) return;
        const lastSeen = localStorage.getItem('tg-last-seen-notification');
        if (latest.createdAt !== lastSeen) setHasNewNotification(true);
      })
      .catch(() => {});
  }, [status]);
 
  function changeLanguage(lang) {
    setProfile((prev) => {
      const next = { ...(prev || {}), til: lang };
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  }
 
  function downloadCurrentChat() {
    const userEmail = authData?.user?.email;
    const SESSIONS_KEY = storageKey('toshkentgpt.sessions.v1', userEmail);
    const ACTIVE_KEY = storageKey('toshkentgpt.activeId.v1', userEmail);
 
    const sessions = loadJSON(SESSIONS_KEY, []);
    const activeId = localStorage.getItem(ACTIVE_KEY);
    const active = sessions.find((s) => s.id === activeId) || sessions[0];
 
    if (!active || !active.messages?.length) {
      showToast("Yuklab olish uchun suhbat topilmadi.", 'error');
      return;
    }
 
    const lines = [`ToshkentGPT — ${active.title || 'Suhbat'}`, '='.repeat(40), ''];
    for (const msg of active.messages) {
      const who = msg.role === 'user' ? (profile?.ism || 'Siz') : 'ToshkentGPT';
      const time = msg.time ? new Date(msg.time).toLocaleString('uz-UZ') : '';
      lines.push(`[${time}] ${who}:`);
      lines.push(msg.content || (msg.image ? '(rasm)' : ''));
      lines.push('');
    }
 
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toshkentgpt-${(active.title || 'suhbat').slice(0, 40).replace(/[^\p{L}\p{N}\s-]/gu, '')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
 
  async function connectTelegram() {
    try {
      const res = await fetch('/api/telegram/link-token', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        showToast(data?.error || "Telegram bilan bog'lashda xatolik yuz berdi.", 'error');
        return;
      }
      if (!data.botUsername) {
        showToast("Telegram bot hali sozlanmagan.", 'error');
        return;
      }
      window.open(`https://t.me/${data.botUsername}?start=${data.token}`, '_blank');
    } catch {
      showToast("Telegram bilan bog'lashda xatolik yuz berdi.", 'error');
    }
  }
 
  async function togglePush() {
    if (!isPushSupported()) {
      showToast("Brauzeringiz push-bildirishnomani qoʻllab-quvvatlamaydi.", 'error');
      return;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      showToast("Bu funksiya faqat production saytda ishlaydi.", 'error', 6000);
      return;
    }
 
    setPushBusy(true);
    try {
      if (pushEnabled) {
        const sub = await getCurrentPushSubscription();
        if (sub) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe().catch(() => {});
        }
        setPushEnabled(false);
        showToast("Bildirishnomalar oʻchirildi.", 'info');
        return;
      }
 
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast("Bildirishnoma uchun ruxsat berilmadi.", 'error');
        return;
      }
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        showToast("Push-bildirishnoma hali sozlanmagan.", 'error');
        return;
      }
      const subscription = await subscribeToPush(vapidPublicKey);
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      setPushEnabled(true);
      showToast("Bildirishnomalar yoqildi! 🔔", 'success');
    } catch (err) {
      showToast(err.message || 'Xatolik yuz berdi.', 'error');
    } finally {
      setPushBusy(false);
    }
  }
 
  if (status !== 'authenticated' || !profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--tg-bg)]">
        <Loader2 size={20} className="animate-spin text-[var(--tg-text-3)]" />
      </div>
    );
  }
 
  const user = authData?.user;
 
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
        <h1 className="text-base font-bold">Sozlamalar</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-lg px-4 pb-12 pt-6 sm:px-6">
        {/* --- Profil qisqacha --- */}
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
          {user?.image ? (
            <img src={user.image} alt="" className="h-12 w-12 flex-shrink-0 rounded-full" />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tg-hover)] text-sm font-bold">
              {(user?.name || 'U')[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name || profile?.ism || 'Foydalanuvchi'}</p>
            <p className="truncate text-xs text-[var(--tg-text-3)]">{user?.email}</p>
          </div>
        </div>
 
        {/* --- HISOB --- */}
        <SectionLabel>Hisob</SectionLabel>
        <div className="space-y-2">
          <Row
            icon={Sparkles}
            label="Tarif"
            href="/tariflar"
            right={
              <span className="flex items-center gap-1.5 text-xs text-[var(--tg-text-3)]">
                {PLANS[planId]?.name || 'Lite'} <ChevronRight size={15} className="text-[var(--tg-text-4)]" />
              </span>
            }
          />
          <Row icon={BrainCircuit} label="Men haqimda nima bilasan?" href="/mening-malumotlarim" />
          <Row icon={GraduationCap} label="Men nimani oʻrganishim kerak?" href="/mutaxassislik" />
          <Row icon={Gift} label="Doʻstlarni taklif qilish" href="/taklif" />
        </div>
 
        {/* --- SUHBAT --- */}
        <SectionLabel>Suhbat</SectionLabel>
        <div className="space-y-2">
          <Row icon={Download} label="Suhbatni yuklab olish" onClick={downloadCurrentChat} />
          <Row icon={FolderOpen} label="Fayllar tarixi" href="/fayllar" />
          <Row icon={Film} label="Rasmlardan video" href="/video" />
        </div>
 
        {/* --- KO'RINISH --- */}
        <SectionLabel>Koʻrinish</SectionLabel>
        <div className="space-y-2">
          <Row
            icon={theme === 'dark' ? Moon : Sun}
            label={theme === 'dark' ? 'Tungi rejim' : 'Yorugʻ rejim'}
            onClick={toggleTheme}
            right={<Toggle on={theme === 'dark'} />}
          />
          <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-4">
            <div className="mb-2.5 flex items-center gap-3 text-sm text-[var(--tg-text-1)]">
              <Languages size={17} />
              Bot tili
            </div>
            <div className="flex gap-1.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                    (profile?.til || 'auto') === lang.code
                      ? 'bg-[#2F9E96] text-white'
                      : 'bg-[var(--tg-hover)] text-[var(--tg-text-2)]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>
 
        {/* --- ULANISHLAR --- */}
        <SectionLabel>Ulanishlar</SectionLabel>
        <div className="space-y-2">
          <Row icon={Send} label="Telegram bilan bogʻlash" onClick={connectTelegram} />
          <Row
            icon={Bell}
            label="Bildirishnomalar"
            onClick={togglePush}
            right={pushBusy ? <Loader2 size={15} className="animate-spin text-[var(--tg-text-4)]" /> : <Toggle on={pushEnabled} />}
          />
          <Row
            icon={History}
            label="Bildirishnomalar tarixi"
            href="/bildirishnomalar"
            right={
              hasNewNotification ? (
                <span className="h-2 w-2 rounded-full bg-[#E4A93B]" />
              ) : (
                <ChevronRight size={15} className="text-[var(--tg-text-4)]" />
              )
            }
          />
        </div>
 
        {/* --- MA'LUMOT VA YORDAM --- */}
        <SectionLabel>Maʼlumot va yordam</SectionLabel>
        <div className="space-y-2">
          <Row icon={Info} label="ToshkentGPT haqida" href="/toshkentgpt-haqida" />
          <Row icon={Users} label="Biz haqimizda" href="/biz-haqimizda" />
          <Row icon={HelpCircle} label="Yordam" href="/yordam" />
          <Row icon={MessageSquare} label="Shikoyat va takliflar" href="/shikoyat" />
        </div>
 
        {/* --- HUQUQIY --- */}
        <SectionLabel>Huquqiy</SectionLabel>
        <div className="space-y-2">
          <Row icon={ShieldCheck} label="Maxfiylik siyosati" href="/maxfiylik-siyosati" />
          <Row icon={FileCheck} label="Foydalanish shartlari" href="/foydalanish-shartlari" />
        </div>
 
        {/* --- CHIQISH --- */}
        <div className="mt-8">
          <Row icon={LogOut} label="Hisobdan chiqish" onClick={() => signOut()} danger right={<span />} />
        </div>
 
        <p className="mt-8 text-center text-[10px] text-[var(--tg-text-4)]">ToshkentGPT v{APP_VERSION}</p>
      </main>
    </div>
  );
}
 