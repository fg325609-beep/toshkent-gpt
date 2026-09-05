'use client';
 
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// Maxfiylik siyosati — HAMMAGA OCHIQ sahifa (tizimga kirish shart emas),
// chunki Play Market va foydalanuvchilar ro'yxatdan o'tishdan OLDIN ham
// buni o'qiy olishlari kerak.
//
// MUHIM: Bu matn ToshkentGPT'ning HAQIQIY funksiyalariga (Google orqali
// kirish, Gemini AI, Redis, Telegram bot va h.k.) asoslanib yozilgan.
// Diqqat: bu yuridik maslahat emas — agar rasmiy ro'yxatdan o'tish
// (masalan Play Market) uchun kerak bo'lsa, yuristga ko'rsatib
// tasdiqlatishni maslahat beramiz.
// ============================================================
export default function MaxfiylikSiyosatiPage() {
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
        <h1 className="text-base font-bold">Maxfiylik siyosati</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-[var(--tg-text-2)] sm:px-6">
        <p className="mb-6 text-xs text-[var(--tg-text-4)]">Oxirgi yangilanish: 2026-yil</p>
 
        <p className="mb-5">
          ToshkentGPT (&quot;biz&quot;, &quot;xizmat&quot;) sizning maxfiyligingizni jiddiy qabul qiladi. Ushbu sahifa
          xizmatimizdan foydalanganingizda qanday ma&apos;lumotlar yig&apos;ilishini, ular qanday ishlatilishini va
          huquqlaringiz nimalardan iboratligini tushuntiradi.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">1. Qanday ma&apos;lumotlar yig&apos;iladi</h2>
        <ul className="mb-4 list-disc space-y-1.5 pl-5">
          <li><b>Hisob ma&apos;lumotlari:</b> Google orqali kirganingizda ism, email manzil va profil rasmingiz olinadi.</li>
          <li><b>Suhbat tarixi:</b> Yozgan xabarlaringiz va AI javoblari xizmatni ko&apos;rsatish uchun saqlanadi.</li>
          <li><b>Profil faktlari:</b> Suhbat davomida siz aytgan ism, qiziqishlar kabi ma&apos;lumotlarni (shaxsiylashtirish uchun) eslab qolamiz — bularni istalgan vaqt &quot;Men haqimda nima bilasan?&quot; sahifasidan ko&apos;rish va o&apos;chirish mumkin.</li>
          <li><b>Yuklangan fayllar:</b> Rasm, PDF, Word yoki Excel fayl yuklasangiz, mazmuni AI orqali tahlil qilinadi. Sohaviy mutaxassislik (&quot;Men nimani o&apos;rganishim kerak?&quot;) funksiyasida hujjatdan qisqa xulosa saqlanadi.</li>
          <li><b>Telegram (ixtiyoriy):</b> Agar Telegram hisobingizni bog&apos;lasangiz, Telegram foydalanuvchi ID&apos;ingiz email manzilingizga bog&apos;lanadi.</li>
          <li><b>To&apos;lov so&apos;rovlari:</b> Tarif sotib olish so&apos;rovi yuborsangiz, tanlagan tarifingiz va vaqti saqlanadi. Karta raqamlaringiz yoki bank ma&apos;lumotlaringiz BIZGA umuman yuborilmaydi va saqlanmaydi.</li>
        </ul>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">2. Ma&apos;lumotlar qanday ishlatiladi</h2>
        <ul className="mb-4 list-disc space-y-1.5 pl-5">
          <li>Sizga AI yordamida javob berish va suhbatni davom ettirish uchun;</li>
          <li>Xizmatni shaxsiylashtirish (ismingiz bilan murojaat qilish, tanlagan tilingizda javob berish) uchun;</li>
          <li>Tarif va kunlik limitni nazorat qilish uchun;</li>
          <li>Xizmatni yaxshilash va texnik xatoliklarni tuzatish uchun.</li>
        </ul>
        <p className="mb-4">
          Ma&apos;lumotlaringiz hech qachon sotilmaydi va reklama maqsadida uchinchi shaxslarga berilmaydi.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">3. Uchinchi tomon xizmatlari</h2>
        <p className="mb-2">Xizmatimiz quyidagi ishonchli tashqi xizmatlardan foydalanadi:</p>
        <ul className="mb-4 list-disc space-y-1.5 pl-5">
          <li><b>Google</b> — hisobga kirish uchun;</li>
          <li><b>Google Gemini AI</b> — suhbat, rasm va matn tahlili uchun;</li>
          <li><b>Upstash (Redis)</b> — ma&apos;lumotlarni xavfsiz saqlash uchun;</li>
          <li><b>Vercel</b> — xizmatni joylashtirish (hosting) uchun;</li>
          <li><b>Telegram</b> — agar botni ulasangiz, xabar almashish uchun;</li>
          <li><b>Pollinations.ai</b> — bepul rasm yaratish uchun.</li>
        </ul>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">4. Ma&apos;lumotlaringizni nazorat qilish</h2>
        <p className="mb-4">
          &quot;Men haqimda nima bilasan?&quot; sahifasidan bot siz haqingizda bilgan barcha faktlarni ko&apos;rishingiz va
          o&apos;chirishingiz mumkin. Hisobingizni butunlay o&apos;chirtirish uchun{' '}
          <Link href="/shikoyat" className="text-[#2F9E96] underline">
            Shikoyat va takliflar
          </Link>{' '}
          sahifasi orqali biz bilan bog&apos;lanishingiz mumkin.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">5. Xavfsizlik</h2>
        <p className="mb-4">
          Ma&apos;lumotlaringiz shifrlangan ulanishlar orqali uzatiladi va ishonchli, sanoat standartidagi
          serverlarda saqlanadi. Biroq, internetdagi hech qanday tizim 100% xavfsiz emasligini yodda tuting.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">6. Yosh chegarasi</h2>
        <p className="mb-4">
          Xizmatimiz 13 yoshdan katta foydalanuvchilar uchun mo&apos;ljallangan. Agar siz 18 yoshdan kichik
          bo&apos;lsangiz, ota-onangiz yoki vasiyingiz roziligi bilan foydalanishingiz tavsiya etiladi.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">7. O&apos;zgarishlar</h2>
        <p className="mb-4">
          Ushbu siyosat vaqti-vaqti bilan yangilanishi mumkin. Muhim o&apos;zgarishlar bo&apos;lsa, ilova ichida
          xabardor qilamiz.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">8. Bog&apos;lanish</h2>
        <p className="mb-4">
          Savollaringiz bo&apos;lsa,{' '}
          <Link href="/shikoyat" className="text-[#2F9E96] underline">
            Shikoyat va takliflar
          </Link>{' '}
          sahifasi orqali murojaat qiling.
        </p>
      </main>
    </div>
  );
}
 