'use client';
 
import { Sparkles, X } from 'lucide-react';
 
// ============================================================
// "Nimalar yangilandi?" oynasi — versiya oshganda (page.jsx APP_VERSION'ni
// localStorage bilan solishtirib) FAQAT MAVJUD foydalanuvchilarga
// ko'rsatiladi (yangi foydalanuvchilar allaqachon tanishuv jarayonidan
// o'tadi, ularga bu ortiqcha).
// ============================================================
export default function WhatsNewModal({ open, version, items, onClose }) {
  if (!open) return null;
 
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--tg-overlay)] p-0 sm:items-center sm:p-4">
      <div className="tg-pop-in w-full max-w-sm rounded-t-2xl border border-[var(--tg-border)] bg-[var(--tg-bg)] p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
            >
              <Sparkles size={16} className="text-[#0D0F14]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--tg-text-1)]">Nimalar yangilandi?</h2>
              <p className="text-[11px] text-[var(--tg-text-4)]">Versiya {version}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--tg-text-3)] transition hover:text-[var(--tg-text-1)]">
            <X size={16} />
          </button>
        </div>
 
        <ul className="mb-5 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-[var(--tg-text-2)]">
              <span>{item}</span>
            </li>
          ))}
        </ul>
 
        <button
          onClick={onClose}
          className="flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
        >
          Zoʻr, tushunarli!
        </button>
      </div>
    </div>
  );
}
 