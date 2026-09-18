'use client';
 
import { COMMANDS } from '@/lib/commands';
 
// Tez boshlash uchun tayyor savollar — bosilganda DARHOL yuboriladi
// (buyruq tugmalaridan farqi shu: ularda foydalanuvchi mavzuni oʻzi yozadi).
const QUICK_ASKS = ['Aka, ishlar qalay?', 'Nimalarni qila olasan?', 'Menga ish topishda yordam ber'];
 
// Katta sarlavhaning ko'rinishi admin panelidan (/api/hero) boshqariladi.
const FONTS = {
  display: 'var(--font-display)',
  sans: 'var(--font-geist-sans)',
  mono: 'var(--font-geist-mono)',
};
 
const SIZES = {
  sm: 'text-[20px] sm:text-[25px]',
  md: 'text-[26px] sm:text-[32px]',
  lg: 'text-[32px] sm:text-[42px]',
};
 
// Rang va shriftni CSS uslubiga aylantiradi. Gradient tanlangan bo'lsa
// matnning o'zi gradient bilan bo'yaladi, aks holda oddiy bitta rang.
export function heroTitleStyle(hero) {
  const base = { fontFamily: FONTS[hero?.font] || FONTS.display };
  if (hero?.colorMode === 'solid') {
    return { ...base, color: hero.color || '#E4A93B' };
  }
  return {
    ...base,
    backgroundImage: `linear-gradient(90deg, ${hero?.gradientFrom || '#F3EEE2'}, ${hero?.gradientTo || '#E4A93B'})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  };
}
 
// ============================================================
// Suhbat hali boshlanmagandagi ekran.
//
// Tuzilishi (ChatGPT'dagidek):
//   1) katta sarlavha + salomlashuv
//   2) YOZISH QATORI — ekranning o'rtasida (children sifatida keladi)
//   3) buyruq tugmalari va tayyor savollar — yozish qatorining TAGIDA
//
// Birinchi xabar yuborilishi bilan bu ekran yo'qoladi: yozish qatori
// pastki holatiga qaytadi, buyruqlar esa chapdagi panelga o'tadi.
// ============================================================
export default function StartScreen({ hero, greeting, onCommandPick, onSuggestionClick, children }) {
  const title = hero?.text || 'Xoʻsh, nimadan boshlaymiz?';
  const subtitle = hero?.subtitle || greeting;
  return (
    <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6 sm:px-6 tg-scroll">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center py-6">
        <h2
          className={`text-center font-extrabold leading-tight ${SIZES[hero?.size] || SIZES.md}`}
          style={heroTitleStyle(hero)}
        >
          {title}
        </h2>
 
        {subtitle && (
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[var(--tg-text-2)]">{subtitle}</p>
        )}
 
        {/* Yozish qatori — aynan shu yerda, o'rtada turadi. */}
        <div className="mt-7 w-full">{children}</div>
 
        {/* Buyruq tugmalari — endi yozish qatorining TAGIDA. */}
        <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                onClick={() => onCommandPick?.(cmd.prefix)}
                className="group flex items-center gap-3 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface-2)] px-3.5 py-2.5 text-left transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--tg-hover)] text-[#E4A93B] transition group-hover:bg-[var(--tg-hover-strong)]">
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[var(--tg-text-1)]">{cmd.label}</span>
                  <span className="block truncate text-[11px] text-[var(--tg-text-3)]">{cmd.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
 
        {/* Tayyor savollar — bosilsa darhol yuboriladi. */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {QUICK_ASKS.map((q) => (
            <button
              key={q}
              onClick={() => onSuggestionClick(q)}
              className="rounded-full border border-[var(--tg-border)] px-3.5 py-1.5 text-xs text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text-1)]"
            >
              {q}
            </button>
          ))}
        </div>
 
        <p className="mt-5 text-center text-[11px] text-[var(--tg-text-4)]">
          ToshkentGPT xato qilishi mumkin · Enter — yuborish, Shift+Enter — yangi qator
        </p>
      </div>
    </main>
  );
}
 
