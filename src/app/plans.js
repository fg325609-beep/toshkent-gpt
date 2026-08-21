// Tariflar konfiguratsiyasi — bitta joyda, frontend ham backend ham shu yerdan o'qiydi.
// Raqamlarni (limit, narx) shu yerda o'zgartirsangiz, hamma joyda yangilanadi.

export const PLANS = {
  lite: {
    id: 'lite',
    name: 'Lite',
    priceLabel: 'Bepul',
    priceAmount: 0,
    tagline: 'Har kuni erkin muloqot uchun',
    dailyLimit: 15,
    modelEnv: 'GEMINI_MODEL_LITE',
    paid: false,
    features: ['Kuniga 15 xabargacha', 'Oddiy tezlikdagi javoblar', 'Suhbatlar tarixi saqlanadi', 'Rasm va fayl yuborish'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceLabel: "20 000 so'm / oy",
    priceAmount: 20000,
    tagline: 'Tezroq va sifatliroq javoblar',
    dailyLimit: 60, // TO'LANGAN Pro uchun kunlik limit
    modelEnv: 'GEMINI_MODEL_PRO',
    paid: true,
    trial: {
      limit: 10, // to'lovsiz sinov: shu miqdorda xabar
      cooldownHours: 3, // ...dan keyin, shuncha soatdan so'ng qayta ochiladi
    },
    featuresIntro: "Lite'dagi hammasi, plyus:",
    features: ['Kuniga 60 xabargacha', 'Tezroq va sifatliroq javoblar', 'Bepul sinov: har 3 soatda 10 ta xabar'],
  },
  max: {
    id: 'max',
    name: 'Max',
    priceLabel: "50 000 so'm / oy",
    priceAmount: 50000,
    tagline: 'Katta kunlik limit, kuchli model',
    dailyLimit: 200,
    modelEnv: 'GEMINI_MODEL_MAX',
    paid: true,
    featuresIntro: "Pro'dagi hammasi, plyus:",
    features: ['Kuniga 200 xabargacha', 'Kuchliroq AI modeli', 'Ustuvor javob tezligi'],
  },
  promax: {
    id: 'promax',
    name: 'Pro Max',
    priceLabel: "80 000 so'm / oy",
    priceAmount: 80000,
    tagline: 'Deyarli cheksiz, eng kuchli model',
    dailyLimit: 1000,
    modelEnv: 'GEMINI_MODEL_PROMAX',
    paid: true,
    featuresIntro: "Max'dagi hammasi, plyus:",
    features: ['Kuniga 1000 xabargacha', 'Deyarli cheksiz foydalanish', 'Eng kuchli model, eng tez javob'],
  },
};

export const PLAN_ORDER = ['lite', 'pro', 'max', 'promax'];

// To'lov qabul qilinadigan karta.
export const PAYMENT_CARD = {
  number: '7777 0106 4941 8220',
  holder: 'F. GOFUROV',
  bank: 'Alif Karta',
};
