// ============================================================
// "/fayllar" sahifasi uchun meta-ma'lumotlar (SEO + ijtimoiy tarmoq kartasi).
// Sahifaning o'zi 'use client' bo'lgani uchun metadata shu layout'da —
// Telegram, Instagram, WhatsApp, Facebook, X va boshqalarda havola
// ulashilganda sarlavha, tavsif va rasm shundan olinadi.
// ============================================================
const TITLE = 'Fayllar tarixi';
const DESCRIPTION = 'Yuklangan va bot yaratgan rasm, video va fayllar.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: `${TITLE} · ToshkentGPT`,
    description: DESCRIPTION,
    url: 'https://toshkentgpt.uz/fayllar',
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
