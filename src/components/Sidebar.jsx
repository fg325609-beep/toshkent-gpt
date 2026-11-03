'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  Pin,
  PinOff,
  Pencil,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import { formatTime } from '@/lib/format';
import { APP_VERSION } from '@/lib/version';
import { COMMANDS } from '@/lib/commands';
import BrandMark, { BrandWordmark } from './BrandMark';

// ============================================================
// Chap yon panel.
//
// Katta ekranda panel DOIM ko'rinib turadi, lekin uni YOPIB ham qo'ysa
// bo'ladi (yuqoridagi « tugmasi). Telefonda esa hamburger orqali ustiga
// chiqadi.
//
// Suhbatlar sana bo'yicha guruhlanadi (Qadalgan, Bugun, Kecha, Oxirgi 7 kun,
// Avvalgi); har birini qadash (pin), qayta nomlash va o'chirish mumkin.
// ============================================================

const NAV_LINKS = [
  { href: '/klip', icon: Sparkles, label: 'Podkast → klip' },
  { href: '/tariflar', icon: CreditCard, label: 'Tariflar' },
  { href: '/yordam', icon: HelpCircle, label: 'Yordam' },
  { href: '/taklif', icon: MessageSquarePlus, label: 'Taklif va shikoyat' },
  { href: '/sozlamalar', icon: Settings, label: 'Sozlamalar' },
];

function groupLabel(iso) {
  if (!iso) return 'Avvalgi';
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return 'Bugun';
  if (t >= startOfToday - 86400000) return 'Kecha';
  if (t >= startOfToday - 6 * 86400000) return 'Oxirgi 7 kun';
  if (t >= startOfToday - 29 * 86400000) return 'Oxirgi 30 kun';
  return 'Avvalgi';
}

const GROUP_ORDER = ['Qadalgan', 'Bugun', 'Kecha', 'Oxirgi 7 kun', 'Oxirgi 30 kun', 'Avvalgi'];

// ----- Bitta suhbat qatori (nom, menyu, qayta nomlash) -----
function SessionRow({ s, active, onOpen, onDelete, onTogglePin, onRename }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.title || '');
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [menuOpen]);

  useEffect(() => {
    if (editing) {
      setDraft(s.title || '');
      requestAnimationFrame(() => inputRef.current?.select());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function commit() {
    const t = draft.trim();
    if (t && t !== s.title) onRename(s.id, t);
    setEditing(false);
  }

  return (
    <div
      className={`group relative flex items-center gap-1 rounded-xl pl-2.5 pr-1 transition ${
        active ? 'bg-[var(--tg-hover-strong)]' : 'hover:bg-[var(--tg-hover)]'
      }`}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="my-1 w-full rounded-md border border-[var(--tg-border-strong)] bg-[var(--tg-surface)] px-1.5 py-1 text-xs text-[var(--tg-text-1)] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => onOpen(s)}
          onDoubleClick={() => setEditing(true)}
          className="min-w-0 flex-1 py-2 text-left"
          title={s.title}
        >
          <p className="flex items-center gap-1 truncate text-[12.5px] font-medium text-[var(--tg-text-1)]">
            {s.pinned && <Pin size={10} className="flex-shrink-0 text-[var(--tg-gold)]" />}
            <span className="truncate">{s.title}</span>
          </p>
        </button>
      )}

      {!editing && (
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-label="Suhbat menyusi"
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-[var(--tg-text-4)] transition hover:bg-[var(--tg-hover-strong)] hover:text-[var(--tg-text-1)] ${
              menuOpen ? 'opacity-100' : 'opacity-70 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="tg-pop-in absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-[var(--tg-shadow-lg)]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onTogglePin(s.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
              >
                {s.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                {s.pinned ? 'Qadashni olish' : 'Qadash'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
              >
                <Pencil size={13} />
                Qayta nomlash
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setMenuOpen(false);
                  onDelete(s.id, e);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-red-400 transition hover:bg-red-500/10"
              >
                <Trash2 size={13} />
                Oʻchirish
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  onTogglePin,
  onRenameSession,
  onCommandPick,
  chatStarted,
  planInfo,
  user,
  theme,
  onToggleTheme,
}) {
  const [query, setQuery] = useState('');

  // Qidiruv ham suhbat SARLAVHASI, ham ICHIDAGI XABARLAR matni bo'yicha ishlaydi.
  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      if (s.title?.toLowerCase().includes(q)) return true;
      return s.messages?.some((m) => m.content?.toLowerCase().includes(q));
    });
  }, [sessions, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of filteredSessions) {
      const key = s.pinned ? 'Qadalgan' : groupLabel(s.updatedAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)]);
  }, [filteredSessions]);

  const limitPercent = planInfo && planInfo.limit ? Math.min(100, Math.round(((planInfo.used || 0) / planInfo.limit) * 100)) : 0;

  function panel(isOverlay) {
    const closeIfOverlay = isOverlay ? onClose : undefined;

    return (
      <div className="flex h-full w-full flex-col border-r border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-3">
        <div className="mb-3 flex items-center gap-2.5 px-1">
          <BrandMark size={30} variant="ring" />
          <h2 className="flex-1 truncate leading-none">
            <BrandWordmark size={15} />
          </h2>
          <button
            type="button"
            onClick={isOverlay ? onClose : onCollapse}
            title={isOverlay ? 'Yopish' : 'Panelni yopish'}
            aria-label="Panelni yopish"
            className="tg-iconbtn h-7 w-7"
          >
            {isOverlay ? <X size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <button
          type="button"
          onClick={onNewChat}
          className="tg-sendbtn mb-3 flex w-full flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#0A0A0B] transition hover:opacity-90"
        >
          <Plus size={16} />
          Yangi suhbat
          <span className="ml-auto hidden rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] font-medium opacity-70 sm:inline">Ctrl+Shift+O</span>
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
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tg-text-4)] transition hover:text-[var(--tg-text-1)]"
              aria-label="Tozalash"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {chatStarted && (
          <div className="mb-3 flex-shrink-0">
            <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">Buyruqlar</p>
            <div className="grid grid-cols-2 gap-1.5">
              {COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => {
                      onCommandPick?.(cmd.prefix);
                      closeIfOverlay?.();
                    }}
                    title={cmd.hint}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--tg-border)] px-2 py-1.5 text-[11px] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
                  >
                    <Icon size={13} className="flex-shrink-0 text-[var(--tg-gold)]" />
                    <span className="truncate">{cmd.short || cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto tg-scroll">
          {sessions.length === 0 && <p className="mt-6 text-center text-xs text-[var(--tg-text-4)]">Hali suhbat yoʻq.</p>}
          {sessions.length > 0 && filteredSessions.length === 0 && (
            <p className="mt-6 text-center text-xs text-[var(--tg-text-4)]">{`"${query}" boʻyicha hech narsa topilmadi.`}</p>
          )}
          {grouped.map(([label, items]) => (
            <div key={label}>
              <p className="mb-1 px-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">{label}</p>
              <div className="space-y-0.5">
                {items.map((s) => (
                  <SessionRow
                    key={s.id}
                    s={s}
                    active={s.id === activeSessionId}
                    onOpen={(sess) => {
                      onOpenSession(sess);
                      closeIfOverlay?.();
                    }}
                    onDelete={onDeleteSession}
                    onTogglePin={onTogglePin}
                    onRename={onRenameSession}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ===== Pastki qism: limit + eng kerakli bo'limlar ===== */}
        <div className="mt-2 flex-shrink-0 border-t border-[var(--tg-border)] pt-2">
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
                    background: planInfo.remaining <= 3 ? '#EF4444' : 'linear-gradient(90deg, var(--tg-gold), var(--tg-teal))',
                  }}
                />
              </div>
              {planInfo.resetAt && planInfo.remaining <= 3 && (
                <p className="mt-1 text-[10px] text-[var(--tg-text-4)]">Soat {formatTime(planInfo.resetAt)}da yangilanadi</p>
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
                <Icon size={15} className={item.href === '/klip' ? 'text-[var(--tg-teal)]' : ''} />
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
              {user?.image ? <img src={user.image} alt="" className="h-full w-full object-cover" /> : <User size={13} className="text-[var(--tg-text-2)]" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-[var(--tg-text-1)]">{user?.name || 'Profil'}</span>
              <span className="block text-[10px] text-[var(--tg-text-4)]">v{APP_VERSION}</span>
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {railOpen && <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] lg:block">{panel(false)}</aside>}

      {open && (
        <div className="fixed inset-0 z-40 flex justify-start lg:hidden">
          <div className="absolute inset-0 bg-[var(--tg-overlay)]" onClick={onClose} />
          <div className="tg-sidebar-in relative h-full w-full max-w-xs">{panel(true)}</div>
        </div>
      )}
    </>
  );
}
