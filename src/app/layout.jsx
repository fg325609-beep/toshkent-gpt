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
 
const SITE_URL = "https://toshkent-gpt.vercel.app";
const TITLE = "ToshkentGPT — koʻcha tilida gaplashuvchi AI";
const SHORT_TITLE = "ToshkentGPT";
const DESCRIPTION =
  "Toshkentcha uslubda, samimiy va hazilkash gaplashadigan AI yordamchi. Telefonga ilova sifatida ham o'rnatiladi.";
const KEYWORDS = [
  "ToshkentGPT",
  "AI yordamchi",
  "sun'iy intellekt",
  "o'zbek tilida chatbot",
  "koʻcha tili",
  "Toshkent",
  "chatbot",
  "AI Uzbekistan",
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
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SHORT_TITLE,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: SHORT_TITLE,
      },
    ],
    locale: "uz_UZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
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
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <ToastContainer />
        <RegisterSW />
      </body>
    </html>
  );
}
 