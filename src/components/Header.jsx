'use client';
 
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, Plus, Settings, Sun, Moon, MessageSquare, Sparkles, LogOut, User, Info, Users, Languages, Send, BrainCircuit, Gift, GraduationCap } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { PLANS } from '@/app/plans';
 
// Ochiq menyu tashqarisiga bosilganda uni yopadi. Avval bu "butun ekranni
// qoplaydigan ko'rinmas parda" (fixed inset-0 overlay) orqali qilinardi, lekin
// u ba'zan haqiqiy sichqoncha bosishini menyu ichidagi tugmalarga
// yetkazmay, o'zi "yutib" yuborayotgan edi.
//
// MUHIM: bu yerda aynan 'click' hodisasi ishlatiladi, 'pointerdown' emas —
// 'pointerdown' juda erta (sichqoncha tugmasi bosilgan zahoti) ishga
// tushadi va menyuni ULGURMASDAN yopib qo'yishi mumkin edi, natijada
// bosilgan tugmaning o'z vazifasi (mavzuni almashtirish, sahifaga o'tish)
// hech qachon bajarilmay qolardi. 'click' esa bosib-qo'yib yuborish TO'LIQ
// yakunlangandan keyin ishga tushadi — shu sabab avval ichkaridagi tugma
// o'z ishini bajaradi, keyin kerak bo'lsa menyu yopiladi.
function useCloseOnOutsideClick(open, onClose, ref) {
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose?.();
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
 
export default function Header({
  user,
  theme,
  onToggleTheme,
  language,
  onChangeLanguage,
  planId,
  navMenuOpen,
  onToggleNavMenu,
  onCloseNavMenu,
  avatarMenuOpen,
  onToggleAvatarMenu,
  onCloseAvatarMenu,
  onOpenHistory,
  onNewChat,
  onConnectTelegram,
}) {
  const navMenuRef = useRef(null);
  const avatarMenuRef = useRef(null);
 
  useCloseOnOutsideClick(navMenuOpen, onCloseNavMenu, navMenuRef);
  useCloseOnOutsideClick(avatarMenuOpen, onCloseAvatarMenu, avatarMenuRef);
 
  return (
    <header className="relative z-30 flex items-center justify-between border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/90 px-4 py-3 backdrop-blur sm:px-6">
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
        <div className="relative" ref={navMenuRef}>
          <button
            onClick={onToggleNavMenu}
            title="Sozlamalar"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
          >
            <Settings size={16} />
          </button>
 
          {navMenuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  onToggleTheme?.();
                  onCloseNavMenu?.();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Yorugʻ rejim' : 'Qorongʻu rejim'}
              </button>
 
              <div className="px-3 py-2">
                <div className="mb-1.5 flex items-center gap-2 text-xs text-[var(--tg-text-2)]">
                  <Languages size={14} />
                  Bot tili
                </div>
                <div className="flex gap-1">
                  {[
                    { id: 'auto', label: 'Avto' },
                    { id: 'uz', label: 'UZ' },
                    { id: 'ru', label: 'RU' },
                    { id: 'en', label: 'EN' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeLanguage?.(opt.id)}
                      className={`flex-1 rounded-lg border px-1.5 py-1 text-[11px] font-medium transition ${
                        (language || 'auto') === opt.id
                          ? 'border-[#2F9E96] bg-[#2F9E96]/15 text-[#2F9E96]'
                          : 'border-[var(--tg-border)] text-[var(--tg-text-3)] hover:bg-[var(--tg-hover)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
 
              <button
                type="button"
                onClick={() => {
                  onConnectTelegram?.();
                  onCloseNavMenu?.();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                <Send size={14} />
                Telegram bilan bogʻlash
              </button>
 
              <div className="my-1 h-px bg-[var(--tg-border)]" />
 
              <Link
                href="/shikoyat"
                onClick={onCloseNavMenu}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                <MessageSquare size={14} />
                Shikoyat va takliflar
              </Link>
 
              <Link
                href="/toshkentgpt-haqida"
                onClick={onCloseNavMenu}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                <Info size={14} />
                ToshkentGPT haqida
              </Link>
 
              <Link
                href="/mening-malumotlarim"
                onClick={onCloseNavMenu}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                <BrainCircuit size={14} />
                Men haqimda nima bilasan?
              </Link>
 
              <Link
                href="/mutaxassislik"
                onClick={onCloseNavMenu}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                <GraduationCap size={14} />
                Men nimani oʻrganishim kerak?
              </Link>
 
              <Link
                href="/taklif"
                onClick={onCloseNavMenu}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                <Gift size={14} />
                Doʻstlarni taklif qilish
              </Link>
 
              <Link
                href="/biz-haqimizda"
                onClick={onCloseNavMenu}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                <Users size={14} />
                Biz haqimizda
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
          )}
        </div>
 
        {/* Profil Menyusi */}
        <div className="relative" ref={avatarMenuRef}>
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
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-1 shadow-xl">
              <div className="truncate px-3 py-2 text-xs text-[var(--tg-text-3)]">{user?.email}</div>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
              >
                <LogOut size={13} />
                Chiqish
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}