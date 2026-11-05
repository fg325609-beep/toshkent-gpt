import BrandMark from '@/components/BrandMark';

// Sahifa yuklanayotganda — harakatlanuvchi logotip.
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--tg-bg)]">
      <BrandMark size={64} variant="orbit" thinking />
    </div>
  );
}
