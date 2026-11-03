import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import RegisterSW from "./register-sw";
import AuthSessionProvider from "./session-provider";
import ToastContainer from "@/components/ToastContainer";
 
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
 
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
 
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
 
const SITE_URL = "https://toshkentgpt.uz";
const TITLE = "ToshkentGPT — koʻcha tilida gaplashuvchi AI";
const SHORT_TITLE = "ToshkentGPT";
const DESCRIPTION =
  "Oʻzbek tilida, Toshkentcha samimiy uslubda gaplashadigan sunʼiy intellekt: savol-javob, rasm chizish, kod, video va hujjat tahlili, podkastdan klip, ovozli suhbat. Veb, Telegram va telefon ilovasi.";
const KEYWORDS = [
  "ToshkentGPT",
  "AI yordamchi",
  "sun'iy intellekt",
  "o'zbek tilida chatbot",
  "koʻcha tili",
  "Toshkent",
  "chatbot",
  "AI Uzbekistan",
  "ToshkentGPT nima",
  "o'zbekcha AI",
  "podkastdan klip",
  "video tahlil AI",
];
 
// To'liq meta-ma'lumotlar: qidiruv tizimlari (SEO) va ijtimoiy tarmoqlarda
// (Telegram, WhatsApp, Instagram va h.k.) havola ulashilganda chiroyli
// ko'rinishi uchun. Har bir maydonning vazifasi qisqacha izohlangan.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s · ${SHORT_TITLE}`,
  },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: SHORT_TITLE,
  authors: [{ name: "Farhod Gʻofurov" }],
  creator: "Farhod Gʻofurov",
  category: "technology",
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
  },
    // Google Search Console tasdiqlash kodi.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SHORT_TITLE,
  },
  // Silka (link) birov bilan ulashilganda Telegram/WhatsApp/Instagram va h.k.
  // ichida chiqadigan sarlavha, tavsif va rasm — shu yerdan olinadi.
  // Rasm (1200×630) src/app/opengraph-image.jsx orqali dinamik chiziladi —
  // Next uni har bir sahifaning og:image / twitter:image'iga o'zi qo'shadi.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SHORT_TITLE,
    locale: "uz_UZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@toshkentgpt",
  },
  other: {
    // Telegram "instant view" va ba'zi messenjerlar uchun qo'shimcha
    "telegram:channel": "@toshkentgpt",
    "og:image:alt": TITLE,
  },
};
 
// Responsivelik uchun: mobil brauzerlarda pinch-zoom bilan chatga xalaqit
// bermasligi uchun maximumScale cheklangan, lekin foydalanuvchi hali ham
// tizim sozlamalaridan matn o'lchamini kattalashtira oladi (accessibility).
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0D0F14" },
    { media: "(prefers-color-scheme: light)", color: "#F7F5EF" },
  ],
};
 
export default function RootLayout({ children }) {
  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          // Sahifa chizilishidan oldin saqlangan mavzuni qo'yib qo'yamiz —
          // aks holda bir lahza noto'g'ri rang ko'rinib (FOUC), keyin almashadi.
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.setAttribute('data-theme', localStorage.getItem('tg-theme') || 'dark')}catch(e){}",
          }}
        />
                <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: SHORT_TITLE,
              alternateName: ["Toshkent GPT", "ToshkentGPT AI"],
              url: SITE_URL,
              description: DESCRIPTION,
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Web, Android, iOS",
              inLanguage: "uz",
              author: { "@type": "Person", name: "Farhod Gʻofurov" },
              offers: { "@type": "Offer", price: "0", priceCurrency: "UZS" },
            }),
          }}
        />
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <ToastContainer />
        <RegisterSW />
      </body>
    </html>
  );
}
 