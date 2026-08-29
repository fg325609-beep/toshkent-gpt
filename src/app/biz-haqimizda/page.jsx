'use client';
 
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Heart, ShieldCheck } from 'lucide-react';
import { LinkedinGlyph, InstagramGlyph } from '@/components/icons/BrandIcons';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// "Biz haqimizda" — Shikoyat/Tariflar sahifalari bilan bir xil
// uslubda alohida manzilli sahifa (/biz-haqimizda).
//
// MATNNI TAHRIRLASH: pastdagi HIKOYA va JIHATLAR ro'yxatini o'zingizga
// mos ravishda o'zgartiring — bu yerdagi matn shunchaki namunaviy variant.
// ============================================================
 
const JIHATLAR = [
  {
    icon: Sparkles,
    title: 'Koʻcha tilida',
    text: 'Rasmiy, quruq javoblar oʻrniga — xuddi jigaringiz bilan gaplashgandek, tabiiy oʻzbek tilida.',
  },
  {
    icon: Heart,
    title: 'Kichik jamoa, katta gʻayrat',
    text: 'Bitta dasturchi va yaxshi niyat bilan boshlangan loyiha — foydalanuvchilar fikri bilan har kuni yaxshilanadi.',
  },
  {
    icon: ShieldCheck,
    title: 'Maʼlumotlaringiz xavfsiz',
    text: 'Suhbatlaringiz faqat oʻzingizga tegishli — uchinchi shaxslarga sotilmaydi, reklama uchun ishlatilmaydi.',
  },
];
 
export default function BizHaqimizdaPage() {
  const { status } = useSession();
  const router = useRouter();
 
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
 
  if (status !== 'authenticated') return null;
 
  return (
    <div className="relative min-h-dvh bg-[var(--tg-bg)] text-[var(--tg-text-1)]">
      <GirihPattern />
 
      <header className="relative z-10 flex items-center gap-3 border-b border-[var(--tg-border)] bg-[var(--tg-bg)]/90 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
        >
          <ArrowLeft size={17} />
        </Link>
        <h1 className="text-base font-bold">Biz haqimizda</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-sm px-4 py-8 sm:px-6">
        <p className="text-sm leading-relaxed text-[var(--tg-text-2)]">
          ToshkentGPT — oʻzbek tilida, xususan koʻcha (jonli, kundalik) uslubda gaplasha oladigan sunʼiy
          intellekt yordamchisi sifatida yaratildi. Maqsadimiz — har bir oʻzbekiston fuqarosi uchun AI
          texnologiyasini yaqinroq, tushunarliroq va samimiyroq qilish.
        </p>
 
        <div className="mt-8 space-y-5">
          {JIHATLAR.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[#E4A93B]">
                <Icon size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--tg-text-1)]">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--tg-text-3)]">{text}</p>
              </div>
            </div>
          ))}
        </div>
 
        <div className="mt-8 border-t border-[var(--tg-border)] pt-5">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-4)]">
            Ijtimoiy tarmoqlarda
          </p>
          <div className="flex gap-2">
            <a
              href="https://linkedin.com/in/farhod-gofurov-frontend-aa45a63b7"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
            >
              <LinkedinGlyph />
            </a>
            <a
              href="https://instagram.com/code.farhod"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:border-[var(--tg-border-strong)] hover:bg-[var(--tg-hover)]"
            >
              <InstagramGlyph />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
 