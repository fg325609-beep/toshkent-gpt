'use client';
 
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { GoogleGlyph } from './icons/BrandIcons';
import GirihPattern from './GirihPattern';
import BrandMark from './BrandMark';
 
const CAPABILITIES = ['Suhbatlashadi', 'Rasm chizadi', 'Kod yozadi', 'Video va hujjat oʻqiydi', 'Podkastdan klip kesadi', 'Ovozda gapiradi'];
 
// ============================================================
// Google bilan kirish ekrani — foydalanuvchi hali tasdiqlanmagan bo'lsa shu ko'rinadi.
// Bu SAYTNING BIRINCHI TAASSUROTI, shuning uchun logo/sarlavhadan tashqari
// nima qila olishini ham qisqacha ko'rsatib qo'yamiz.
// ============================================================
export default function SignInScreen() {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--tg-bg)] px-6 text-center">
      <div className="tg-aurora" />
      <GirihPattern />
      <div className="tg-pop-in relative z-10 flex flex-col items-center">
        <div className="tg-splash-logo relative mb-1">
          <BrandMark size={104} variant="hero" />
        </div>
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
          Koʻcha tilida gaplashadigan, ishingga yordam beradigan sunʼiy intellekt yordamchi.
        </p>
 
        <div className="mt-5 flex max-w-xs flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
          {CAPABILITIES.map((item, i) => (
            <span key={item} className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--tg-text-2)]">{item}</span>
              {i < CAPABILITIES.length - 1 && <span className="h-1 w-1 rounded-full bg-[var(--tg-border-strong)]" />}
            </span>
          ))}
        </div>
 
        <button
          onClick={() => signIn('google')}
          className="mt-8 flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-lg transition hover:scale-[1.03] hover:bg-gray-100 active:scale-[0.98]"
        >
          <GoogleGlyph />
          Google bilan kirish
        </button>
        <p className="mt-4 text-[11px] text-[var(--tg-text-4)]">Bepul boshlash mumkin — karta shart emas</p>
 
        <div className="mt-6 flex items-center gap-3 text-[10px] text-[var(--tg-text-4)]">
          <Link href="/maxfiylik-siyosati" className="underline hover:text-[var(--tg-text-3)]">
            Maxfiylik siyosati
          </Link>
          <span>·</span>
          <Link href="/foydalanish-shartlari" className="underline hover:text-[var(--tg-text-3)]">
            Foydalanish shartlari
          </Link>
        </div>
      </div>
    </div>
  );
}
 