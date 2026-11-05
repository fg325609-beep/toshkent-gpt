'use client';

import Link from 'next/link';
import BrandMark from '@/components/BrandMark';

// ============================================================
// Kutilmagan xato ekrani — oq sahifa o'rniga brend uslubida, tushunarli
// matn va "qayta urinish" tugmasi. Xato tafsiloti faqat konsolda.
// ============================================================
export default function GlobalError({ error, reset }) {
  if (typeof console !== 'undefined') console.error('Sahifa xatosi:', error);
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--tg-bg)] px-6 text-center text-[var(--tg-text-1)]">
      <div className="tg-aurora" />
      <div className="tg-pop-in relative z-10 flex flex-col items-center">
        <BrandMark size={88} variant="hero" />
        <h1 className="mt-5 text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
          Nimadir xato ketdi, jigar
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--tg-text-3)]">
          Sahifani qayta yuklab koʻring. Takrorlansa — Sozlamalar → «Taklif va shikoyat» orqali xabar bering.
        </p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => reset()} className="tg-sendbtn rounded-xl px-5 py-2.5 text-sm font-semibold text-[#0D0F14]">
            Qayta urinish
          </button>
          <Link href="/" className="rounded-xl border border-[var(--tg-border)] px-5 py-2.5 text-sm font-medium text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]">
            Bosh sahifa
          </Link>
        </div>
      </div>
    </div>
  );
}
