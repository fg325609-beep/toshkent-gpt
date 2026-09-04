'use client';
 
import { useMemo, useState } from 'react';
import { X, Plus, History, Trash2, Search } from 'lucide-react';
import { formatRelative } from '@/lib/format';
 
// ============================================================
// Chapdan chiqadigan panel: "+ Yangi suhbat", qidiruv va suhbatlar ro'yxati.
// Hamburger tugmasi bosilganda ko'rinadi.
// ============================================================
export default function Sidebar({ open, sessions, activeSessionId, onClose, onNewChat, onOpenSession, onDeleteSession }) {
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
 
  if (!open) return null;
 
  return (
    <div className="fixed inset-0 z-40 flex justify-start">
      <div className="absolute inset-0 bg-[var(--tg-overlay)]" onClick={onClose} />
      <div className="tg-sidebar-in relative flex h-full w-full max-w-xs flex-col border-r border-[var(--tg-border)] bg-[var(--tg-bg)] p-4">
        <div className="mb-4 flex items-center gap-2.5">
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
            onClick={onClose}
            className="flex-shrink-0 text-[var(--tg-text-3)] transition hover:text-[var(--tg-text-1)]"
          >
            <X size={16} />
          </button>
        </div>
 
        <button
          onClick={onNewChat}
          className="mb-3 flex w-full flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#0D0F14] transition hover:opacity-90"
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
            >
              <X size={13} />
            </button>
          )}
        </div>
 
        <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
          <History size={12} />
          Suhbatlar
        </p>
        <div className="flex-1 space-y-1.5 overflow-y-auto tg-scroll">
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
              className={`group flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                s.id === activeSessionId
                  ? 'border-[#E4A93B]/30 bg-[#E4A93B]/10'
                  : 'border-[var(--tg-border)] bg-[var(--tg-hover)] hover:bg-[var(--tg-hover)]'
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
      </div>
    </div>
  );
}
 