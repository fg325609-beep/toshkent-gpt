import Link from 'next/link';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// SEO sahifasi — "ToshkentGPT nima?"
//
// MUHIM: bu sahifada 'use client' YO'Q — ya'ni u SERVER tomonda
// tayyor HTML bo'lib chiqadi. Saytning qolgan sahifalari brauzerda
// JavaScript orqali chiziladi, shuning uchun Google ularda matn
// ko'rmaydi. Bu sahifa esa Google uchun "o'qiladigan" matn beradi —
// odam "toshkent gpt" deb qidirganda topilishi uchun shu kerak.
// ============================================================
 
export const metadata = {
  title: 'ToshkentGPT nima? — oʻzbek tilida AI yordamchi',
  description:
    "ToshkentGPT — o'zbek tilida, ko'cha uslubida gaplashadigan sun'iy intellekt yordamchisi. Savol-javob, matn yozish, rasm va video yaratish, prezentatsiya tayyorlash imkoniyatlari bilan.",
  alternates: {
    canonical: 'https://toshkentgpt.uz/toshkentgpt-nima',
  },
};
 
const IMKONIYATLAR = [
  {
    sarlavha: 'Oʻzbek tilida suhbat',
    matn: "ToshkentGPT o'zbek tilini tushunadi va rasmiy emas, tirik, ko'cha uslubida javob beradi. Rus va ingliz tillarida ham gaplasha oladi.",
  },
  {
    sarlavha: 'Rasm yaratish',
    matn: "Tavsifni yozasiz — ToshkentGPT undan rasm chizib beradi. Masalan: «quyosh botayotgan Toshkent koʻchasi».",
  },
  {
    sarlavha: 'Video yaratish',
    matn: 'Yuklagan rasmingizni jonlantirib, qisqa video qilib beradi.',
  },
  {
    sarlavha: 'Prezentatsiya tayyorlash',
    matn: 'Mavzuni aytasiz — tayyor PowerPoint fayli qilib beradi.',
  },
  {
    sarlavha: 'Hujjat oʻqish',
    matn: 'PDF, Word va Excel fayllarni yuklab, ular haqida savol berishingiz mumkin.',
  },
  {
    sarlavha: 'Ovozli muloqot',
    matn: 'Yozish oʻrniga gapirishingiz, javobni esa ovozda eshitishingiz mumkin.',
  },
];
 
const SAVOLLAR = [
  {
    savol: 'ToshkentGPT bepulmi?',
    javob:
      "Ha, asosiy imkoniyatlari bepul. Kuchliroq modellar va rasm/video yaratish kabi qoʻshimcha funksiyalar uchun Pro, Max va Pro Max tariflari mavjud.",
  },
  {
    savol: 'ToshkentGPTdan qanday foydalanaman?',
    javob:
      "Saytga kiring va Google hisobingiz bilan roʻyxatdan oʻting — shundan soʻng darhol yozishni boshlashingiz mumkin. Telefonga ilova sifatida ham oʻrnatiladi.",
  },
  {
    savol: 'ToshkentGPT kim tomonidan yaratilgan?',
    javob:
      "ToshkentGPT — Oʻzbekistonda, oʻzbek tilida soʻzlashuvchi foydalanuvchilar uchun yaratilgan AI yordamchi. Muallif: Farhod Gʻofurov.",
  },
  {
    savol: 'Telegram orqali ishlatsa boʻladimi?',
    javob:
      'Ha, ToshkentGPT Telegram boti orqali ham ishlaydi — hisobingizni bogʻlab, xuddi saytdagidek suhbatlashishingiz mumkin.',
  },
];
 
export default function ToshkentGptNimaPage() {
  return (
    <div className="relative min-h-dvh bg-[var(--tg-bg)] text-[var(--tg-text-1)]">
      <GirihPattern />
 
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold sm:text-3xl">ToshkentGPT nima?</h1>
 
        <p className="mb-5 text-sm leading-relaxed text-[var(--tg-text-2)]">
          <b>ToshkentGPT</b> — oʻzbek tilida gaplashadigan sunʼiy intellekt (AI) yordamchisi. U boshqa
          chatbotlardan farqli oʻlaroq quruq, kitobiy tilda emas, balki tirik, samimiy va hazilkash
          toshkentcha uslubda javob beradi. Savolingizga javob topish, matn yozish, rasm va video
          yaratish, prezentatsiya tayyorlash — bularning hammasi bitta joyda.
        </p>
 
        <p className="mb-8 text-sm leading-relaxed text-[var(--tg-text-2)]">
          ToshkentGPT brauzerda ham, telefonda ilova sifatida ham ishlaydi va foydalanish uchun
          Google hisobingiz bilan kirish kifoya.
        </p>
 
        <Link
          href="/"
          className="mb-12 inline-flex items-center rounded-lg bg-gradient-to-r from-[var(--tg-logo-grad-start)] to-[var(--tg-logo-grad-end)] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
        >
          ToshkentGPT bilan suhbatni boshlash
        </Link>
 
        <h2 className="mb-4 mt-4 text-xl font-bold">ToshkentGPT nimalar qila oladi?</h2>
        <div className="mb-12 space-y-5">
          {IMKONIYATLAR.map((item) => (
            <section key={item.sarlavha}>
              <h3 className="mb-1 text-base font-semibold">{item.sarlavha}</h3>
              <p className="text-sm leading-relaxed text-[var(--tg-text-2)]">{item.matn}</p>
            </section>
          ))}
        </div>
 
        <h2 className="mb-4 text-xl font-bold">Koʻp beriladigan savollar</h2>
        <div className="mb-12 space-y-5">
          {SAVOLLAR.map((item) => (
            <section key={item.savol}>
              <h3 className="mb-1 text-base font-semibold">{item.savol}</h3>
              <p className="text-sm leading-relaxed text-[var(--tg-text-2)]">{item.javob}</p>
            </section>
          ))}
        </div>
 
        <nav className="flex flex-wrap gap-4 border-t border-[var(--tg-border)] pt-6 text-sm text-[var(--tg-text-3)]">
          <Link href="/" className="hover:text-[var(--tg-text-1)]">
            Bosh sahifa
          </Link>
          <Link href="/yordam" className="hover:text-[var(--tg-text-1)]">
            Yordam
          </Link>
          <Link href="/maxfiylik-siyosati" className="hover:text-[var(--tg-text-1)]">
            Maxfiylik siyosati
          </Link>
          <Link href="/foydalanish-shartlari" className="hover:text-[var(--tg-text-1)]">
            Foydalanish shartlari
          </Link>
        </nav>
      </main>
 
      {/* Google savol-javoblarni qidiruv natijalarida koʻrsatishi uchun. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: SAVOLLAR.map((item) => ({
              '@type': 'Question',
              name: item.savol,
              acceptedAnswer: { '@type': 'Answer', text: item.javob },
            })),
          }),
        }}
      />
    </div>
  );
}
 