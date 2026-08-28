'use client';

import Link from 'next/link';
import { Menu, Plus, Settings, Sun, Moon, MessageSquare, Sparkles, LogOut, User } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { PLANS } from '@/app/plans';

export default function Header({
  user,
  theme,
  onToggleTheme,
  planId,
  navMenuOpen,
  onToggleNavMenu,
  onCloseNavMenu,
  avatarMenuOpen,
  onToggleAvatarMenu,
  onCloseAvatarMenu,
  onOpenHistory,
  onNewChat,
}) {
  return (
    <header className="relative z-10 flex items-center justify-between border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenHistory}
          title="Suhbatlar"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
        >
          <Menu size={17} />
        </button>

        <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
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

        {/* Sozlamalar Menyusi */}
        <div className="relative">
          <button
            onClick={onToggleNavMenu}
            title="Sozlamalar"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
          >
            <Settings size={16} />
          </button>
          
          {navMenuOpen && (
            <>
              {/* Overlay z-index pasaytirildi va pointer-events belgilandi */}
              <div className="fixed inset-0 z-10" onClick={onCloseNavMenu} />
              
              {/* Dropdown z-index oshirildi */}
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-xl">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTheme?.();
                    onCloseNavMenu?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  {theme === 'dark' ? 'Yorugʻ rejim' : 'Qorongʻu rejim'}
                </button>
                
                <Link
                  href="/shikoyat"
                  onClick={onCloseNavMenu}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                >
                  <MessageSquare size={14} />
                  Shikoyat va takliflar
                </Link>

                <div className="my-1 h-px bg-[var(--tg-border)]" />

                <Link
                  href="/tariflar"
                  onClick={onCloseNavMenu}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} />
                    Tariflar
                  </span>
                  <span className="rounded-full border border-[var(--tg-border)] px-1.5 py-0.5 text-[10px]">
                    {PLANS[planId || 'lite']?.name || 'Lite'}
                  </span>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Profil Menyusi */}
        <div className="relative">
          <button
            onClick={onToggleAvatarMenu}
            className="ml-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--tg-border)]"
          >
            {user?.image ? (
              <img src={user.image} alt={user.name || ''} className="h-full w-full object-cover" />
            ) : (
              <User size={14} className="text-[var(--tg-text-2)]" />
            )}
          </button>
          
          {avatarMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onCloseAvatarMenu} />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-xl">
                <div className="truncate px-3 py-2 text-xs text-[var(--tg-text-3)]">{user?.email}</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                >
                  <LogOut size={13} />
                  Chiqish
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}