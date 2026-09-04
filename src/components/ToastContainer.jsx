'use client';
 
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { subscribeToasts, getToasts, dismissToast } from '@/lib/toast';
 
const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const COLORS = {
  success: 'text-[#2F9E96] border-[#2F9E96]/30',
  error: 'text-red-400 border-red-500/30',
  info: 'text-[var(--tg-text-2)] border-[var(--tg-border)]',
};
 
export default function ToastContainer() {
  const [items, setItems] = useState([]);
 
  useEffect(() => {
    setItems(getToasts());
    return subscribeToasts(setItems);
  }, []);
 
  if (!items.length) return null;
 
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:top-4">
      {items.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            className={`tg-pop-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-[var(--tg-surface)] px-3.5 py-3 shadow-xl backdrop-blur ${COLORS[t.type] || COLORS.info}`}
          >
            <Icon size={17} className="mt-0.5 flex-shrink-0" />
            <p className="flex-1 text-xs leading-relaxed text-[var(--tg-text-1)]">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="flex-shrink-0 text-[var(--tg-text-4)] transition hover:text-[var(--tg-text-1)]"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
 