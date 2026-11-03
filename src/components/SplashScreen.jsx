import BrandMark, { BrandWordmark } from './BrandMark';

// ============================================================
// Ilova ochilganda ~1.4 soniya ko'rinadigan qisqa brend ekrani —
// harakatlanuvchi logotip (halqa, orbita, nur) va "oqayotgan" nom.
// ============================================================
export default function SplashScreen() {
  return (
    <div className="tg-splash-overlay fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-hidden bg-[var(--tg-bg)]">
      <div className="tg-aurora" />
      <div className="tg-splash-logo relative">
        <BrandMark size={120} variant="hero" />
      </div>
      <div className="tg-splash-logo flex flex-col items-center gap-1" style={{ animationDelay: '0.1s' }}>
        <BrandWordmark size={22} />
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-[var(--tg-text-4)]">koʻcha tilida gaplashadi</p>
      </div>
    </div>
  );
}
