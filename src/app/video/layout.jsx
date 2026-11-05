// ============================================================
// "/video" sahifasi uchun meta-ma'lumotlar (SEO + ijtimoiy tarmoq kartasi).
// Sahifaning o'zi 'use client' bo'lgani uchun metadata shu layout'da —
// Telegram, Instagram, WhatsApp, Facebook, X va boshqalarda havola
// ulashilganda sarlavha, tavsif va rasm shundan olinadi.
// ============================================================
const TITLE = 'Rasmlardan video';
const DESCRIPTION = "Rasmlaringizdan musiqali slayd-shou video yasang — to'g'ridan-to'g'ri brauzerda, bepul.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://toshkentgpt.uz/video' },
  openGraph: {
    title: `${TITLE} · ToshkentGPT`,
    description: DESCRIPTION,
    url: 'https://toshkentgpt.uz/video',
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
