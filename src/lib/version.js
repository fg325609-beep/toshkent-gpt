// ============================================================
// Ilova versiyasi — HAR SAFAR muhim funksiya qo'shilganda shu raqam
// oshiriladi (masalan 2.0.0 -> 2.1.0). Interfeysning bir necha joyida
// (Sidebar, Sozlamalar) ko'rsatiladi, va CHANGELOG "Nimalar yangilandi?"
// oynasida foydalanuvchiga ko'rsatiladi (page.jsx'da localStorage bilan
// solishtirib, versiya oshgan bo'lsa avtomatik chiqadi).
// ============================================================
export const APP_VERSION = '2.4.0';
 
export const CHANGELOG = [
  {
    version: '2.4.0',
    items: [
      '🌐 Bot endi o\'zi internetdan qidiradi va havolalarni o\'qiydi — javob ostida manbalar chiqadi (Pro va undan yuqori)',
      '🧠 «Fikrlash jarayoni» — javobdan oldin bot nimani o\'ylayotganini ko\'rasiz',
      '🎬 5 GB gacha video/audio — GB\'lab podkastni ham tashlang, AI ko\'radi va eshitadi',
      '✂️ Podkast → klip: tiniq sifat (NVIDIA tezlashtirish), pauzalarni o\'zi kesadi, yuzga qarab 9:16 kadrlash, klip sonini o\'zi tanlaydi',
      '✨ Harakatlanuvchi logotip, yangi boshlanish ekrani, suhbatga avtomatik nom, e\'lon banneri',
      '🛡️ Xatolarga chidamlilik: server band bo\'lsa qayta urinish, tushunarli xabarlar, qisman javob saqlanadi',
      '📣 Har bir sahifa uchun ijtimoiy tarmoq kartasi (Telegram, Instagram, WhatsApp, X) va dinamik OG rasm',
      '📊 Admin panel: tizim holati, AI foydalanish statistikasi, xatolar jurnali, e\'lon va texnik ishlar rejimi',
    ],
  },
  {
    version: '2.3.0',
    items: [
      '✨ Yangi, zamonaviy interfeys: toʻliq kenglikdagi javoblar, kod ranglari, davom-savol tugmalari, sudrab tashlash',
      '🎬 Video va audio yuklab tahlil qildiring — 500 MB gacha, bir xabarga 6 tagacha fayl',
      '✂️ Podkast → klip: uzun videodan hookʼli, subtitrli, 9:16 kliplar (Max / Pro Max)',
      '📌 Suhbatlarni qadash, qayta nomlash; sana boʻyicha guruhlar; Ctrl+Shift+O — yangi suhbat, Esc — toʻxtatish',
      '🤖 Telegram bot: davom-savollar tugma sifatida',
      '📊 Admin panel: bugungi faol/yangi foydalanuvchilar, boʻlimlar navigatsiyasi',
    ],
  },
  {
    version: '2.2.0',
    items: [
      '📄 Word (.docx) va Excel (.xlsx) fayllarni ham yuklab, mazmuni boʻyicha savol bering',
      '🤖 Telegram bot endi rasm va fayllarni (PDF, Word, Excel, matn) tushunadi',
      '🧹 Telegram: /yangi — suhbatni boshidan boshlash, /holat — tarif va limit, /yordam',
      '📅 Bot bugungi sana va Toshkent vaqtini biladi',
      '🖼️ Telegramdagi /rasm ham saytdagi kabi sifatli — tavsif inglizchaga oʻgirilib chiziladi',
      '🛡️ Moderatsiya aniqroq — oddiy soʻzlar (masalan "рубля") endi nomaqbul deb hisoblanmaydi',
    ],
  },
  {
    version: '2.1.0',
    items: [
      "🎓 \"Men nimani o'rganishim kerak?\" — kasbingizga oid hujjat yuklab, botni o'z sohangiz bo'yicha maxsus yordamchiga aylantiring",
      '🎨 Yangi, aniq koʻrinadigan logotip va ilova belgilari',
      "🚫 Nomaqbul tilni aniqlab, avtomatik ogohlantirish/bloklash tizimi",
      "🔊 MP3 sifatida yuklab olinadigan, barqaror ovozli oʻqish",
      "💳 Toʻlovni tasdiqlashda summaga qarab avtomatik oy hisoblash",
    ],
  },
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
 