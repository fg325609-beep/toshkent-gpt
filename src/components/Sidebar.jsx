'use client';
 
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  X,
  Plus,
  Trash2,
  Search,
  CreditCard,
  Settings,
  HelpCircle,
  MessageSquarePlus,
  Sun,
  Moon,
  User,
  PanelLeftClose,
} from 'lucide-react';
import { formatRelative, formatTime } from '@/lib/format';
import { APP_VERSION } from '@/lib/version';
import { COMMANDS } from '@/lib/commands';
 
// ============================================================
// Chap yon panel.
//
// Katta ekranda panel DOIM ko'rinib turadi, lekin endi uni YOPIB ham
// qo'ysa bo'ladi (yuqoridagi « tugmasi). Telefonda esa avvalgidek
// hamburger orqali ustiga chiqadi.
//
// Panel ichida: yangi suhbat, qidiruv, buyruqlar (suhbat boshlangandan
// keyin), suhbatlar ro'yxati, tarif-limit chizig'i va asosiy bo'limlar.
// ============================================================
 
// Pastdagi doimiy ko'rinadigan bo'limlar.
const NAV_LINKS = [
  { href: '/tariflar', icon: CreditCard, label: 'Tariflar' },
  { href: '/yordam', icon: HelpCircle, label: 'Yordam' },
  { href: '/taklif', icon: MessageSquarePlus, label: 'Taklif va shikoyat' },
  { href: '/sozlamalar', icon: Settings, label: 'Sozlamalar' },
];
 
export default function Sidebar({
  open,
  railOpen = true,
  sessions,
  activeSessionId,
  onClose,
  onCollapse,
  onNewChat,
  onOpenSession,
  onDeleteSession,
  onCommandPick,
  chatStarted,
  planInfo,
  user,
  theme,
  onToggleTheme,
}) {
  const [query, setQuery] = useState('');
 
  // Qidiruv ham suhbat SARLAVHASI, ham ICHIDAGI XABARLAR matni bo'yicha ishlaydi —
  // shunda sarlavhada aytilmagan mavzuni ham topish mumkin.
  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      if (s.title?.toLowerCase().includes(q)) return true;
      return s.messages?.some((m) => m.content?.toLowerCase().includes(q));
    });
  }, [sessions, query]);
 
  const limitPercent =
    planInfo && planInfo.limit
      ? Math.min(100, Math.round(((planInfo.used || 0) / planInfo.limit) * 100))
      : 0;
 
  // Panelning ichki qismi — katta ekranda ham, telefonda ham bir xil.
  // isOverlay=true bo'lsa (telefon), havola bosilganda panel yopiladi.
  function panel(isOverlay) {
    const closeIfOverlay = isOverlay ? onClose : undefined;
 
    return (
      <div className="flex h-full w-full flex-col border-r border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-3">
        <div className="mb-3 flex items-center gap-2.5 px-1">
          <img src="/icons/logo-header.png" alt="" className="h-7 w-7 flex-shrink-0 rounded-full" />
          <h2
            className="flex-1 truncate text-[15px] font-extrabold tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              backgroundImage: 'linear-gradient(90deg, var(--tg-logo-grad-start), var(--tg-logo-grad-end))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ToshkentGPT
          </h2>
          <button
            onClick={isOverlay ? onClose : onCollapse}
            title={isOverlay ? 'Yopish' : 'Panelni yopish'}
            aria-label="Panelni yopish"
            className="flex-shrink-0 text-[var(--tg-text-3)] transition hover:text-[var(--tg-text-1)]"
          >
            {isOverlay ? <X size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
 
        <button
          onClick={onNewChat}
          className="mb-3 flex w-full flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#0A0A0B] transition hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
        >
          <Plus size={16} />
          Yangi suhbat
        </button>
 
        <div className="relative mb-3 flex-shrink-0">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tg-text-4)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suhbatlarda qidirish..."
            className="w-full rounded-xl border border-[var(--tg-border)] bg-[var(--tg-hover)] py-2 pl-8 pr-7 text-xs text-[var(--tg-text-1)] placeholder-[var(--tg-text-4)] outline-none focus:border-[var(--tg-border-strong)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tg-text-4)] transition hover:text-[var(--tg-text-1)]"
              aria-label="Tozalash"
            >
              <X size={13} />
            </button>
          )}
        </div>
 
        {/* Buyruqlar — suhbat boshlangach boshlanish ekranidan SHU YERGA ko'chadi. */}
        {chatStarted && (
          <div className="mb-3 flex-shrink-0">
            <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
              Buyruqlar
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      onCommandPick?.(cmd.prefix);
                      closeIfOverlay?.();
                    }}
                    title={cmd.hint}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--tg-border)] px-2 py-1.5 text-[11px] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
                  >
                    <Icon size={13} className="flex-shrink-0 text-[#E4A93B]" />
                    <span className="truncate">{cmd.short || cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
 
        <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
          Suhbatlar
        </p>
        <div className="flex-1 space-y-1 overflow-y-auto tg-scroll">
          {sessions.length === 0 && (
            <p className="mt-6 text-center text-xs text-[var(--tg-text-4)]">Hali suhbat yoʻq.</p>
          )}
          {sessions.length > 0 && filteredSessions.length === 0 && (
            <p className="mt-6 text-center text-xs text-[var(--tg-text-4)]">{`"${query}" boʻyicha hech narsa topilmadi.`}</p>
          )}
          {filteredSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpenSession(s)}
              className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                s.id === activeSessionId
                  ? 'bg-[var(--tg-hover-strong)]'
                  : 'hover:bg-[var(--tg-hover)]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--tg-text-1)]">{s.title}</p>
                <p className="text-[10.5px] text-[var(--tg-text-4)]">{formatRelative(s.updatedAt)}</p>
              </div>
              <span
                onClick={(e) => onDeleteSession(s.id, e)}
                className="text-[var(--tg-text-4)] opacity-60 transition hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </span>
            </button>
          ))}
        </div>
 
        {/* ===== Pastki qism: limit + eng kerakli bo'limlar ===== */}
        <div className="mt-2 flex-shrink-0 border-t border-[var(--tg-border)] pt-2">
          {/* Xabar limiti — avval yozish qatorining tepasida edi, endi shu yerda. */}
          {planInfo && typeof planInfo.limit === 'number' && (
            <Link
              href="/tariflar"
              onClick={closeIfOverlay}
              className="mb-2 block rounded-xl border border-[var(--tg-border)] bg-[var(--tg-hover)] px-2.5 py-2 transition hover:border-[var(--tg-border-strong)]"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="truncate font-semibold text-[var(--tg-text-1)]">
                  {planInfo.mode === 'trial' ? `${planInfo.name} sinovi` : planInfo.name}
                </span>
                <span className="flex-shrink-0 text-[var(--tg-text-3)]">
                  {planInfo.used}/{planInfo.limit}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--tg-border)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${limitPercent}%`,
                    background: planInfo.remaining <= 3 ? '#EF4444' : 'linear-gradient(90deg, #E4A93B, #2F9E96)',
                  }}
                />
              </div>
              {planInfo.resetAt && planInfo.remaining <= 3 && (
                <p className="mt-1 text-[10px] text-[var(--tg-text-4)]">
                  Soat {formatTime(planInfo.resetAt)}da yangilanadi
                </p>
              )}
            </Link>
          )}
 
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeIfOverlay}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
 
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Yorugʻ rejim' : 'Qorongʻu rejim'}
          </button>
 
          <Link
            href="/sozlamalar"
            onClick={closeIfOverlay}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg border border-[var(--tg-border)] px-2.5 py-2 transition hover:bg-[var(--tg-hover)]"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--tg-border)]">
              {user?.image ? (
                <img src={user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <User size={13} className="text-[var(--tg-text-2)]" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-[var(--tg-text-1)]">
                {user?.name || 'Profil'}
              </span>
              <span className="block text-[10px] text-[var(--tg-text-4)]">v{APP_VERSION}</span>
            </span>
          </Link>
        </div>
      </div>
    );
  }
 
  return (
    <>
      {/* Katta ekran: panel doim turadi (yopilmagan bo'lsa). */}
      {railOpen && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] lg:block">{panel(false)}</aside>
      )}
 
      {/* Telefon: hamburger bosilganda ustiga chiqadi. */}
      {open && (
        <div className="fixed inset-0 z-40 flex justify-start lg:hidden">
          <div className="absolute inset-0 bg-[var(--tg-overlay)]" onClick={onClose} />
          <div className="tg-sidebar-in relative h-full w-full max-w-xs">{panel(true)}</div>
        </div>
      )}
    </>
  );
}
 