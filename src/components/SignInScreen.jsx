'use client';

import { signIn } from 'next-auth/react';
import { GoogleGlyph } from './icons/BrandIcons';
import GirihPattern from './GirihPattern';

// ============================================================
// Google bilan kirish ekrani — foydalanuvchi hali tasdiqlanmagan bo'lsa shu ko'rinadi.
// ============================================================
export default function SignInScreen() {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--tg-bg)] px-6 text-center">
      <GirihPattern />
      <div className="relative z-10 flex flex-col items-center">
        <img src="/icons/logo-header.png" alt="ToshkentGPT" className="tg-splash-logo h-20 w-20" />
        <h1
          className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--tg-text-1)]"
          style={{
            fontFamily: 'var(--font-display)',
            backgroundImage: 'linear-gradient(90deg, var(--tg-logo-grad-start), var(--tg-logo-grad-end))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          ToshkentGPT&apos;ga xush kelibsiz
        </h1>
        <p className="mt-2 max-w-xs text-sm text-[var(--tg-text-3)]">
          Davom etish uchun Google hisobing bilan kir — suhbatlaring shu hisobga saqlanadi.
        </p>

        <button
          onClick={() => signIn('google')}
          className="mt-8 flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-lg transition hover:bg-gray-100"
        >
          <GoogleGlyph />
          Google bilan kirish
        </button>
      </div>
    </div>
  );
}
