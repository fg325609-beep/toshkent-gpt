'use client';

// ============================================================
// HARAKATLANUVCHI LOGOTIP — bitta komponent, butun ilovada ishlatiladi:
// splash, kirish ekrani, boshlanish sahifasi, header, yon panel, AI xabari
// avatari, yuklanish holatlari.
//
// Tuzilishi (ichkaridan tashqariga):
//   * logotip rasmi (public/icons/logo-header.png)
//   * yumshoq nur (glow) — nafas oladi
//   * aylanuvchi konus-gradient halqa (oltin ↔ moviy)
//   * qarama-qarshi aylanuvchi nuqtali orbita (ikki "sayyora")
//   * tashqariga tarqaluvchi puls halqalari
//
// variant:
//   'hero'   — katta, barcha effektlar (boshlanish ekrani, kirish, splash)
//   'orbit'  — o'rta, halqa + orbita (header, yon panel)
//   'ring'   — kichik, faqat aylanuvchi halqa (avatar)
//   'static' — harakatsiz (ro'yxatlar, kichik joylar)
// thinking=true — tezroq aylanadi va kuchliroq "nafas oladi" (AI o'ylayotganda).
// prefers-reduced-motion yoqilgan bo'lsa, CSS barcha animatsiyani o'chiradi.
// ============================================================
export default function BrandMark({ size = 40, variant = 'orbit', thinking = false, className = '' }) {
  const px = `${size}px`;
  const showRing = variant !== 'static';
  const showOrbit = variant === 'hero' || variant === 'orbit';
  const showPulse = variant === 'hero';
  const showGlow = variant === 'hero' || thinking;

  return (
    <span
      className={`tg-brand relative inline-flex flex-shrink-0 items-center justify-center ${thinking ? 'tg-brand-thinking' : ''} ${className}`}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      {showGlow && <span className="tg-brand-glow absolute inset-[-18%] rounded-full" />}

      {showPulse && (
        <>
          <span className="tg-brand-pulse absolute inset-0 rounded-full" />
          <span className="tg-brand-pulse absolute inset-0 rounded-full" style={{ animationDelay: '1.3s' }} />
        </>
      )}

      {showRing && <span className="tg-brand-ring absolute inset-0 rounded-full" />}

      {showOrbit && (
        <span className="tg-brand-orbit absolute inset-[-9%] rounded-full">
          <span className="tg-brand-dot tg-brand-dot-gold" />
          <span className="tg-brand-dot tg-brand-dot-teal" />
        </span>
      )}

      <img
        src="/icons/logo-header.png"
        alt=""
        className="tg-brand-logo relative rounded-full"
        style={{ width: '78%', height: '78%' }}
        draggable={false}
      />
    </span>
  );
}

// Matnli logotip (gradient "ToshkentGPT") — bir joyda saqlanadi.
export function BrandWordmark({ className = '', size = 15 }) {
  return (
    <span
      className={`tg-wordmark font-extrabold tracking-tight ${className}`}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: `${size}px`,
        backgroundImage: 'linear-gradient(90deg, var(--tg-logo-grad-start), var(--tg-logo-grad-end), var(--tg-teal))',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      }}
    >
      ToshkentGPT
    </span>
  );
}
