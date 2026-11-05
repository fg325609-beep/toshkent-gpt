// ============================================================
// "/yordam" sahifasi uchun meta-ma'lumotlar (SEO + ijtimoiy tarmoq kartasi).
// Sahifaning o'zi 'use client' bo'lgani uchun metadata shu layout'da —
// Telegram, Instagram, WhatsApp, Facebook, X va boshqalarda havola
// ulashilganda sarlavha, tavsif va rasm shundan olinadi.
// ============================================================
const TITLE = 'Yordam va koʻp beriladigan savollar';
const DESCRIPTION = "ToshkentGPT'dan qanday foydalanish: /rasm, /qidir, /kod, /prezentatsiya buyruqlari, fayl yuklash, Telegram bot, tariflar va chuqur o'ylash rejimi.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://toshkentgpt.uz/yordam' },
  openGraph: {
    title: `${TITLE} · ToshkentGPT`,
    description: DESCRIPTION,
    url: 'https://toshkentgpt.uz/yordam',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} · ToshkentGPT`,
    description: DESCRIPTION,
  },
};

export default function Layout({ children }) {
  return children;
}
