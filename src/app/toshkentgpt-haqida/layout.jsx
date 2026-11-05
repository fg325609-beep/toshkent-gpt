// ============================================================
// "/toshkentgpt-haqida" sahifasi uchun meta-ma'lumotlar (SEO + ijtimoiy tarmoq kartasi).
// Sahifaning o'zi 'use client' bo'lgani uchun metadata shu layout'da —
// Telegram, Instagram, WhatsApp, Facebook, X va boshqalarda havola
// ulashilganda sarlavha, tavsif va rasm shundan olinadi.
// ============================================================
const TITLE = 'ToshkentGPT haqida';
const DESCRIPTION = 'ToshkentGPT nima qila oladi: suhbat, rasm chizish, kod yozish, hujjat va video tahlili, prezentatsiya, ovozli muloqot, podkastdan klip kesish.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://toshkentgpt.uz/toshkentgpt-haqida' },
  openGraph: {
    title: `${TITLE} · ToshkentGPT`,
    description: DESCRIPTION,
    url: 'https://toshkentgpt.uz/toshkentgpt-haqida',
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
