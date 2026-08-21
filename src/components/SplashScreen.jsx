// ============================================================
// Ilova ochilganda ~1.4 soniya ko'rinadigan qisqa brend ekrani.
// ============================================================
export default function SplashScreen() {
  return (
    <div className="tg-splash-overlay fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[var(--tg-bg)]">
      <img src="/icons/logo-header.png" alt="ToshkentGPT" className="tg-splash-logo h-24 w-24" />
      <p
        className="tg-splash-logo text-sm font-bold tracking-tight text-[var(--tg-text-2)]"
        style={{ fontFamily: 'var(--font-display)', animationDelay: '0.1s' }}
      >
        ToshkentGPT
      </p>
    </div>
  );
}
