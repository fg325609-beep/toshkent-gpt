'use client';
 
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, ImageIcon, Mic, History } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// "ToshkentGPT haqida" — Shikoyat/Tariflar sahifalari bilan bir xil
// uslubda alohida manzilli sahifa (/toshkentgpt-haqida).
//
// MATNNI TAHRIRLASH: pastdagi IMKONIYATLAR ro'yxatini haqiqiy
// funksiyalaringizga mos ravishda o'zgartiring.
// ============================================================
 
const IMKONIYATLAR = [
  {
    icon: MessageCircle,
    title: 'Erkin suhbat',
    text: 'Har qanday savol, maslahat yoki shunchaki gurunglashish uchun — koʻcha tilida, tabiiy javoblar.',
  },
  {
    icon: ImageIcon,
    title: 'Rasm va fayl tushunadi',
    text: 'Rasm yuboring — nima ekanini aytib beradi. Matnli fayl yuboring — mazmunini tushunib, javob beradi.',
  },
  {
    icon: Mic,
    title: 'Ovozli kiritish',
    text: 'Yozishga vaqt yoʻqmi? Mikrofon orqali gapiring — matnga oʻzi aylantiradi.',
  },
  {
    icon: History,
    title: 'Suhbatlar tarixi',
    text: 'Barcha eski suhbatlaringiz saqlanadi — istalgan vaqt qaytib, davom ettirishingiz mumkin.',
  },
];
 
export default function ToshkentGPTHaqidaPage() {
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
        <h1 className="text-base font-bold">ToshkentGPT haqida</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-sm px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/icons/logo-header.png" alt="ToshkentGPT" className="h-12 w-12 rounded-full" />
          <div>
            <h2
              className="text-lg font-extrabold tracking-tight"
              style={{
                fontFamily: 'var(--font-display)',
                backgroundImage: 'linear-gradient(90deg, var(--tg-logo-grad-start), var(--tg-logo-grad-end))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ToshkentGPT
            </h2>
            <p className="text-xs text-[var(--tg-text-3)]">koʻcha tilida gaplashadi</p>
          </div>
        </div>
 
        <p className="mt-5 text-sm leading-relaxed text-[var(--tg-text-2)]">
          ToshkentGPT — sunʼiy intellekt asosida ishlaydigan, oʻzbek tilida erkin va samimiy suhbatlashadigan
          yordamchi. Savol bering, rasm yoki fayl tashlang, yoki shunchaki gurunglashib oʻtiring — u har doim
          tayyor.
        </p>
 
        <div className="mt-8 space-y-5">
          {IMKONIYATLAR.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--tg-border)] text-[#2F9E96]">
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
          <Link
            href="/tariflar"
            className="flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-[#0D0F14]"
            style={{ background: 'linear-gradient(135deg, #E4A93B, #2F9E96)' }}
          >
            Tariflarni koʻrish
          </Link>
        </div>
      </main>
    </div>
  );
}