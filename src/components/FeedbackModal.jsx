'use client';

import { X, Send } from 'lucide-react';
import { LinkedinGlyph, InstagramGlyph } from './icons/BrandIcons';

const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/in/farhod-gofurov-frontend-aa45a63b7/',
  instagram: 'https://www.instagram.com/code.farhod/',
  telegram: 'https://t.me/Farhod00111',
};

// ============================================================
// "Shikoyat va takliflar" oynasi — ijtimoiy tarmoq havolalari + forma.
// Forma yuborilganda /api/feedback orqali Telegram botga boradi (page.jsx'da).
// ============================================================
export default function FeedbackModal({ open, onClose, message, onMessageChange, status, onSubmit }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--tg-overlay)]" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--tg-text-1)]">Shikoyat va takliflar</h2>
          <button onClick={onClose} className="text-[var(--tg-text-3)] hover:text-[var(--tg-text-1)]">
            <X size={16} />
          </button>
        </div>

        <p className="mb-3 text-xs text-[var(--tg-text-3)]">Murojaat uchun ijtimoiy tarmoqlarimiz:</p>
        <div className="mb-4 flex items-center gap-3">
          <a
            href={SOCIAL_LINKS.linkedin}
            target="_blank"
            rel="noreferrer"
            title="LinkedIn"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[#0A66C2]/50 hover:text-[#0A66C2]"
          >
            <LinkedinGlyph size={16} />
          </a>
          <a
            href={SOCIAL_LINKS.instagram}
            target="_blank"
            rel="noreferrer"
            title="Instagram"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[#E1306C]/50 hover:text-[#E1306C]"
          >
            <InstagramGlyph size={16} />
          </a>
          <a
            href={SOCIAL_LINKS.telegram}
            target="_blank"
            rel="noreferrer"
            title="Telegram"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[#2AABEE]/50 hover:text-[#2AABEE]"
          >
            <Send size={16} />
          </a>
        </div>

        <form onSubmit={onSubmit} className="space-y-2">
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Fikr-mulohaza yoki shikoyatingizni yozing..."
            rows={4}
            required
            className="w-full resize-none rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-3 text-sm text-[var(--tg-text-1)] outline-none placeholder-[var(--tg-text-3)] focus:border-[#E4A93B]/40"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14] transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
          >
            {status === 'sending' ? 'Yuborilmoqda...' : 'Yuborish'}
          </button>
          {status === 'sent' && (
            <p className="text-center text-xs text-[#2F9E96]">Rahmat! Xabaringiz yuborildi.</p>
          )}
          {status === 'error' && (
            <p className="text-center text-xs text-red-400">Xatolik yuz berdi, qayta urinib koʻring.</p>
          )}
        </form>
      </div>
    </div>
  );
}
