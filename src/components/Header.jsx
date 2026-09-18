'use client';
 
import Link from 'next/link';
import { Menu, PanelLeftOpen, Plus, User } from 'lucide-react';
 
// ============================================================
// Yuqoridagi tor panel.
//
// Avval bu yerda tishli g'ildirak menyusi bor edi va mavzu almashtirish,
// sozlamalar kabi narsalar shu menyu ICHIGA yashiringan edi. Endi ularning
// hammasi chapdagi doimiy panelda ko'rinib turadi, shuning uchun header
// soddalashtirildi: hamburger (faqat telefonda), logo, "Yangi suhbat" va
// profil rasmi.
// ============================================================
export default function Header({ user, railOpen = true, onOpenHistory, onNewChat }) {
  return (
    <header className="relative z-20 flex items-center justify-between border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/80 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2.5">
        {/* Logo telefonda ko'rinmaydi (joy tor — hamburger va tugmalar bor),
            sm va undan katta ekranlarda ko'rinadi. */}
        {/* Katta ekranda yon panel doim turadi — hamburger faqat telefonda kerak. */}
        <button
          onClick={onOpenHistory}
          title={railOpen ? 'Suhbatlar' : 'Panelni ochish'}
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)] ${
            railOpen ? 'lg:hidden' : ''
          }`}
        >
          <Menu size={17} className="lg:hidden" />
          <PanelLeftOpen size={17} className="hidden lg:block" />
        </button>
 
        <div className="relative hidden h-10 w-10 flex-shrink-0 items-center justify-center sm:flex">
          <div
            className="tg-logo-ring absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, #2F9E96, #E4A93B, #2F9E96)',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
            }}
          />
          <span className="tg-logo-pulse absolute inset-0 rounded-full border border-[#2F9E96]/50" />
          <img src="/icons/logo-header.png" alt="ToshkentGPT" className="relative h-8 w-8 rounded-full" />
        </div>
 
        <div className="min-w-0">
          <h1
            className="truncate text-[15px] font-extrabold tracking-tight sm:text-base"
            style={{
              fontFamily: 'var(--font-display)',
              backgroundImage: 'linear-gradient(90deg, var(--tg-logo-grad-start), var(--tg-logo-grad-end))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ToshkentGPT
          </h1>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--tg-text-3)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F9E96] shadow-[0_0_0_3px_rgba(47,158,150,0.2)]" />
            <span className="hidden sm:inline">koʻcha tilida gaplashadi</span>
          </p>
        </div>
      </div>
 
      <div className="flex items-center gap-1.5">
        <button
          onClick={onNewChat}
          title="Yangi suhbat"
          className="flex items-center gap-1.5 rounded-lg border border-[var(--tg-border)] px-3 py-1.5 text-xs font-medium text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Yangi suhbat</span>
        </button>
 
        <Link
          href="/sozlamalar"
          title="Sozlamalar va profil"
          className="ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--tg-border)]"
        >
          {user?.image ? (
            <img src={user.image} alt={user.name || ''} className="h-full w-full object-cover" />
          ) : (
            <User size={14} className="text-[var(--tg-text-2)]" />
          )}
        </Link>
      </div>
    </header>
  );
}
 