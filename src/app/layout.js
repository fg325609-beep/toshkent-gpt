import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import RegisterSW from "./register-sw";
import AuthSessionProvider from "./session-provider";

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
const DESCRIPTION =
  "Toshkentcha uslubda, samimiy va hazilkash gaplashadigan AI yordamchi. Telefonga ilova sifatida ham o'rnatiladi.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ToshkentGPT",
  },
  // Silka (link) birov bilan ulashilganda Telegram/WhatsApp/Instagram va h.k.
  // ichida chiqadigan sarlavha, tavsif va rasm — shu yerdan olinadi.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "ToshkentGPT",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ToshkentGPT",
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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0D0F14",
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
        <RegisterSW />
      </body>
    </html>
  );
}
