// ============================================================
// Ilova versiyasi — HAR SAFAR muhim funksiya qo'shilganda shu raqam
// oshiriladi (masalan 2.0.0 -> 2.1.0). Interfeysning bir necha joyida
// (Sidebar, Sozlamalar) ko'rsatiladi, va CHANGELOG "Nimalar yangilandi?"
// oynasida foydalanuvchiga ko'rsatiladi (page.jsx'da localStorage bilan
// solishtirib, versiya oshgan bo'lsa avtomatik chiqadi).
// ============================================================
export const APP_VERSION = '2.0.0';
 
export const CHANGELOG = [
  {
    version: '2.0.0',
    items: [
      "🎨 /rasm — AI orqali rasm chizish",
      "📊 /prezentatsiya — haqiqiy PowerPoint fayl yaratish",
      "📄 PDF fayllarni yuklab, mazmunini muhokama qilish",
      "🌍 Bot javoblarini boshqa tilda (rus/ingliz) olish",
      "🤖 Telegram bot — hisobingizni bogʻlab, Telegramdan ham foydalaning",
      "🎁 Doʻstlarni taklif qilib ikkovlashib bonus tarif oling",
      "🔄 Javobni qayta yozdirish, tahrirlash va baholash",
    ],
  },
];
 