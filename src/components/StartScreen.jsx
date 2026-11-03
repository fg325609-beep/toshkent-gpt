'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { COMMANDS } from '@/lib/commands';
import BrandMark from './BrandMark';

// Tez boshlash uchun tayyor savollar — bosilganda DARHOL yuboriladi
// (buyruq tugmalaridan farqi shu: ularda foydalanuvchi mavzuni oʻzi yozadi).
const QUICK_ASKS = [
  'Nimalarni qila olasan?',
  'Bugun qanday ish rejalashtiray?',
  'Menga biznes g\'oya ber',
  'Ingliz tilini o\'rganishga yordam ber',
];

// Katta sarlavhaning ko'rinishi admin panelidan (/api/hero) boshqariladi.
const FONTS = {
  display: 'var(--font-display)',
  sans: 'var(--font-geist-sans)',
  mono: 'var(--font-geist-mono)',
};

const SIZES = {
  sm: 'text-[22px] sm:text-[28px]',
  md: 'text-[28px] sm:text-[36px]',
  lg: 'text-[34px] sm:text-[46px]',
};

// Rang va shriftni CSS uslubiga aylantiradi. Gradient tanlangan bo'lsa
// matnning o'zi gradient bilan bo'yaladi, aks holda oddiy bitta rang.
export function heroTitleStyle(hero) {
  const base = { fontFamily: FONTS[hero?.font] || FONTS.display };
  if (hero?.colorMode === 'solid') {
    return { ...base, color: hero.color || '#E4A93B' };
  }
  // Standart krem rang (#F3EEE2) yorug' fonda ko'rinmas edi — standart
  // qiymat bo'lsa mavzuga mos CSS o'zgaruvchisini ishlatamiz.
  const from = hero?.gradientFrom && hero.gradientFrom.toLowerCase() !== '#f3eee2' ? hero.gradientFrom : 'var(--tg-logo-grad-start)';
  return {
    ...base,
    backgroundImage: `linear-gradient(90deg, ${from}, ${hero?.gradientTo || '#E4A93B'})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  };
}

function timeGreeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Xayrli tun' : h < 12 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech';
  return name ? `${part}, ${name}!` : `${part}!`;
}

// ============================================================
// Suhbat hali boshlanmagandagi ekran.
//
//   1) salomlashuv (kun vaqtiga qarab) + katta sarlavha
//   2) YOZISH QATORI — ekranning o'rtasida (children sifatida keladi)
//   3) imkoniyat kartalari (buyruqlar + Podkast→klip) va tayyor savollar
// ============================================================
export default function StartScreen({ hero, firstName, onCommandPick, onSuggestionClick, children }) {
  const title = hero?.text || 'Xoʻsh, nimadan boshlaymiz?';
  const subtitle = hero?.subtitle;
  // Salomlashuv kun vaqtiga bog'liq — server va brauzer soati farq qilmasligi
  // uchun faqat brauzerda (mount'dan keyin) hisoblanadi.
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    setGreeting(timeGreeting(firstName));
  }, [firstName]);

  return (
    <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6 sm:px-6 tg-scroll">
      <div className="tg-aurora" />
      <div className="relative mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center py-4">
        <div className="tg-fade-in mb-4">
          <BrandMark size={84} variant="hero" />
        </div>
        <p className="tg-fade-in mb-2 min-h-[18px] text-[13px] font-medium text-[var(--tg-text-3)]">{greeting}</p>
        <h2 className={`tg-fade-in text-center font-extrabold leading-[1.1] tracking-tight ${SIZES[hero?.size] || SIZES.md}`} style={heroTitleStyle(hero)}>
          {title}
        </h2>
        {subtitle && <p className="tg-fade-in mt-3 max-w-md text-center text-sm leading-relaxed text-[var(--tg-text-2)]">{subtitle}</p>}

        {/* Yozish qatori — aynan shu yerda, o'rtada turadi. */}
        <div className="tg-rise mt-7 w-full">{children}</div>

        {/* Imkoniyat kartalari */}
        <div className="tg-rise mt-5 grid w-full grid-cols-2 gap-2 sm:grid-cols-5 [animation-delay:80ms]">
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                type="button"
                onClick={() => onCommandPick?.(cmd.prefix)}
                className="tg-card group flex flex-col items-start gap-2 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--tg-gold)]/12 text-[var(--tg-gold)] transition group-hover:bg-[var(--tg-gold)]/20">
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[var(--tg-text-1)]">{cmd.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--tg-text-3)]">{cmd.hint}</span>
                </span>
              </button>
            );
          })}
          <Link
            href="/klip"
            className="tg-card group flex flex-col items-start gap-2 rounded-2xl border border-[var(--tg-teal)]/30 bg-[var(--tg-teal)]/6 p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--tg-teal)]/60"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--tg-teal)]/15 text-[var(--tg-teal)]">
              <Sparkles size={16} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[13px] font-semibold text-[var(--tg-text-1)]">
                Podkast → klip <ArrowUpRight size={12} className="text-[var(--tg-teal)]" />
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[var(--tg-text-3)]">Hook, subtitr, 9:16 — tayyor</span>
            </span>
          </Link>
        </div>

        {/* Tayyor savollar — bosilsa darhol yuboriladi. */}
        <div className="tg-rise mt-4 flex flex-wrap justify-center gap-2 [animation-delay:140ms]">
          {QUICK_ASKS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSuggestionClick(q)}
              className="rounded-full border border-[var(--tg-border)] px-3.5 py-1.5 text-xs text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
            >
              {q}
            </button>
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] text-[var(--tg-text-4)]">
          Rasm, video, audio, PDF, Word, Excel — hammasini tashlang · ToshkentGPT xato qilishi mumkin
        </p>
      </div>
    </main>
  );
}
