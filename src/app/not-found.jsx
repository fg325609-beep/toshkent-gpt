import Link from 'next/link';
import BrandMark from '@/components/BrandMark';

export const metadata = { title: 'Sahifa topilmadi', robots: { index: false } };

// 404 — brend uslubida.
export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--tg-bg)] px-6 text-center text-[var(--tg-text-1)]">
      <div className="tg-aurora" />
      <div className="tg-pop-in relative z-10 flex flex-col items-center">
        <BrandMark size={88} variant="hero" />
        <p className="mt-5 text-[64px] font-extrabold leading-none text-[var(--tg-gold)]" style={{ fontFamily: 'var(--font-display)' }}>
          404
        </p>
        <h1 className="mt-2 text-lg font-bold">Bunaqa sahifa yoʻq, jigar</h1>
        <p className="mt-1 max-w-xs text-sm text-[var(--tg-text-3)]">Havola eskirgan yoki notoʻgʻri yozilgan boʻlishi mumkin.</p>
        <Link href="/" className="tg-sendbtn mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-[#0D0F14]">
          Suhbatga qaytish
        </Link>
      </div>
    </div>
  );
}
