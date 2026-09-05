'use client';
 
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import GirihPattern from '@/components/GirihPattern';
 
// ============================================================
// Foydalanish shartlari — hammaga ochiq sahifa (tizimga kirish shart emas).
// MUHIM: bu yuridik maslahat emas — rasmiy talab bo'lsa, yuristga
// ko'rsatib tasdiqlatish tavsiya etiladi.
// ============================================================
export default function FoydalanishShartlariPage() {
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
        <h1 className="text-base font-bold">Foydalanish shartlari</h1>
      </header>
 
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-[var(--tg-text-2)] sm:px-6">
        <p className="mb-6 text-xs text-[var(--tg-text-4)]">Oxirgi yangilanish: 2026-yil</p>
 
        <p className="mb-5">
          ToshkentGPT&apos;dan foydalanish orqali siz quyidagi shartlarga rozilik bildirasiz. Iltimos, ularni diqqat
          bilan o&apos;qing.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">1. Xizmat tavsifi</h2>
        <p className="mb-4">
          ToshkentGPT — sun&apos;iy intellekt asosidagi suhbat yordamchisi bo&apos;lib, matnli suhbat, rasm yaratish,
          hujjat tahlili, prezentatsiya tuzish va boshqa funksiyalarni taqdim etadi.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">2. Hisob va mas&apos;uliyat</h2>
        <ul className="mb-4 list-disc space-y-1.5 pl-5">
          <li>Xizmatdan foydalanish uchun haqiqiy Google hisobingiz bilan kirishingiz kerak.</li>
          <li>Hisobingiz xavfsizligi uchun siz mas&apos;ulsiz.</li>
          <li>Noqonuniy, haqoratli yoki boshqalarga zarar yetkazadigan maqsadlarda foydalanish taqiqlanadi.</li>
          <li>Nomaqbul til ishlatgan foydalanuvchilarning hisobi ogohlantirishsiz yoki (takrorlansa) bloklanishi mumkin.</li>
        </ul>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">3. Sun&apos;iy intellekt javoblari haqida</h2>
        <p className="mb-4">
          AI javoblari har doim 100% aniq bo&apos;lishi kafolatlanmaydi. Muhim qarorlar (tibbiy, huquqiy, moliyaviy va
          h.k.) uchun botning javobini yakuniy manba sifatida emas, faqat yordamchi vosita sifatida
          ishlating va zarur bo&apos;lganda mutaxassisga murojaat qiling.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">4. Tariflar va to&apos;lov</h2>
        <ul className="mb-4 list-disc space-y-1.5 pl-5">
          <li>Lite tarif bepul, kunlik xabar limiti bilan taqdim etiladi.</li>
          <li>Pullik tariflar (Pro, Max, Pro Max) qo&apos;shimcha imkoniyatlar va yuqoriroq kunlik limit beradi.</li>
          <li>To&apos;lovlar hozircha qo&apos;lda (bank o&apos;tkazmasi) amalga oshiriladi va admin tomonidan tasdiqlanadi.</li>
          <li>To&apos;langan tarif muddati tugagach, hisobingiz avtomatik Lite tarifga qaytadi.</li>
        </ul>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">5. Kontent va mualliflik huquqi</h2>
        <p className="mb-4">
          AI yaratgan matn, rasm va prezentatsiyalardan shaxsiy va tijorat maqsadlarida foydalanishingiz mumkin.
          Biroq, boshqa shaxslarning mualliflik huquqini buzadigan kontent yaratish uchun xizmatdan
          foydalanish taqiqlanadi.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">6. Xizmatning o&apos;zgarishi</h2>
        <p className="mb-4">
          Xizmat funksiyalari, tariflari yoki narxlari xabardor qilingan holda o&apos;zgartirilishi mumkin.
          Xizmatni istalgan vaqt to&apos;xtatish yoki cheklash huquqini o&apos;zimizda saqlab qolamiz.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">7. Javobgarlikni cheklash</h2>
        <p className="mb-4">
          Xizmat &quot;bor holicha&quot; taqdim etiladi. Biz AI javoblaridan kelib chiqadigan har qanday zarar uchun
          javobgar emasmiz.
        </p>
 
        <h2 className="mb-2 mt-6 text-base font-bold text-[var(--tg-text-1)]">8. Bog&apos;lanish</h2>
        <p className="mb-4">
          Savollaringiz bo&apos;lsa,{' '}
          <Link href="/shikoyat" className="text-[#2F9E96] underline">
            Shikoyat va takliflar
          </Link>{' '}
          sahifasi orqali murojaat qiling. Maxfiylik siyosatimiz bilan{' '}
          <Link href="/maxfiylik-siyosati" className="text-[#2F9E96] underline">
            shu yerda
          </Link>{' '}
          tanishishingiz mumkin.
        </p>
      </main>
    </div>
  );
}
 