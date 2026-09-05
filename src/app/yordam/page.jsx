'use client';
 
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, HelpCircle } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// Yordam / FAQ — tez-tez so'raladigan savollar, "akkordeon" ko'rinishida.
// MATNNI TAHRIRLASH: savol/javoblarni xohlaganingizcha o'zgartiring yoki
// qo'shing.
// ============================================================
 
const FAQ = [
  {
    q: 'Kunlik xabar limiti nima va u qachon yangilanadi?',
    a: 'Har bir tarifda kunlik xabar soni cheklangan (Lite — 15, Pro — 60 va h.k.). Limit har kuni belgilangan vaqtda avtomatik yangilanadi. Joriy holatingizni pastdagi progress-chiziqda ko\'rasiz.',
  },
  {
    q: '/rasm buyrug\'i qanday ishlaydi?',
    a: 'Chatga "/rasm <nima chizish kerak>" deb yozing — masalan "/rasm gitara chalayotgan mushuk". Bot AI orqali shu tavsifga mos rasm chizib beradi.',
  },
  {
    q: '/prezentatsiya buyrug\'i qanday ishlaydi?',
    a: '"/prezentatsiya <mavzu>" deb yozsangiz, bot mavzu bo\'yicha to\'liq PowerPoint (.pptx) fayl tayyorlab, yuklab olish havolasini beradi.',
  },
  {
    q: 'PDF yoki boshqa fayl yuklay olamanmi?',
    a: 'Ha — 📎 tugmasi orqali PDF fayl yuklasangiz, bot uning mazmunini o\'qib, savollaringizga javob beradi.',
  },
  {
    q: '"Chuqur o\'ylash" nima?',
    a: 'Yozish maydonidagi 🧠 tugmasi yoqilsa, bot javob berishdan oldin ko\'proq "o\'ylaydi" — javob sekinroq, lekin murakkab savollar (matematika, kod, tahlil) uchun sifatliroq bo\'ladi.',
  },
  {
    q: 'Do\'stimni taklif qilsam, nima olaman?',
    a: 'Sozlamalar → "Do\'stlarni taklif qilish"dan shaxsiy havolangizni oling. Do\'stingiz shu havola orqali ro\'yxatdan o\'tsa, ikkalangiz ham 2 kunlik Pro tarif (kuniga 60 xabar) bepul olasiz.',
  },
  {
    q: 'Telegram orqali ham foydalansam bo\'ladimi?',
    a: 'Ha — Sozlamalar → "Telegram bilan bog\'lash"ni bosib, ochilgan botga o\'ting. Shundan keyin Telegram\'dagi hisobingiz saytdagi bilan bir xil profil va tarifni ishlatadi.',
  },
  {
    q: '"Men nimani o\'rganishim kerak?" nima uchun kerak?',
    a: 'Agar ma\'lum bir kasbda (masalan shifokor, yurist, buxgalter) ishlasangiz, shu bo\'limda kasbingizni yozib, hujjat yuklasangiz, bot o\'sha soha bo\'yicha maxsus tayyorlangan yordamchiga aylanadi.',
  },
  {
    q: 'Bot men haqimda nimalarni biladi va ularni ko\'ra olamanmi?',
    a: 'Ha — Sozlamalar → "Men haqimda nima bilasan?" bo\'limida bot siz haqingizda o\'rgangan barcha faktlarni ko\'rishingiz va xohlasangiz o\'chirishingiz mumkin.',
  },
  {
    q: 'Tarifni qanday sotib olaman?',
    a: 'Sozlamalar → "Tariflar"dan xohlagan tarifni tanlang, ko\'rsatilgan karta raqamiga to\'lov qiling va so\'rov yuboring. To\'lovingiz tekshirilgach, tarifingiz avtomatik faollashadi.',
  },
  {
    q: 'Xabarim yoki takliflarim bo\'lsa, qayerga yozaman?',
    a: 'Sozlamalar → "Shikoyat va takliflar" orqali to\'g\'ridan-to\'g\'ri yuboring — bevosita ishlab chiquvchiga yetadi.',
  },
];
 
function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-sm font-medium text-[var(--tg-text-1)]">{item.q}</span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-[var(--tg-text-3)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <p className="px-4 pb-3.5 text-sm leading-relaxed text-[var(--tg-text-3)]">{item.a}</p>}
    </div>
  );
}
 
export default function YordamPage() {
  const [openIndex, setOpenIndex] = useState(0);
 
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
        <h1 className="text-base font-bold">Yordam</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3">
          <HelpCircle size={18} className="mt-0.5 flex-shrink-0 text-[#2F9E96]" />
          <p className="text-xs leading-relaxed text-[var(--tg-text-3)]">
            Eng koʻp soʻraladigan savollar. Javobini topa olmasangiz, &quot;Shikoyat va takliflar&quot; orqali toʻgʻridan-toʻgʻri yozing.
          </p>
        </div>
 
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
 