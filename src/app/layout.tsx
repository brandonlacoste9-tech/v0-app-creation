import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import { VisitorBeacon } from "@/components/visitor-beacon";
import {
  DEFAULT_DESCRIPTION,
  getSiteUrl,
  SEO_KEYWORDS,
  SITE_NAME,
} from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — AI UI Builder for Developers | Next.js + Cursor`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  authors: [{ name: SITE_NAME, url: siteUrl }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  icons: {
    icon: [{ url: "/shipboard-logo.jpg", type: "image/jpeg" }],
    apple: [{ url: "/shipboard-logo.jpg" }],
    shortcut: "/shipboard-logo.jpg",
  },
  openGraph: {
    title: `${SITE_NAME} — Describe the idea. Get production UI.`,
    description: DEFAULT_DESCRIPTION,
    url: siteUrl,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI UI builder for developers`,
    description: DEFAULT_DESCRIPTION,
  },
  // Do not set alternates.canonical here — child routes set their own.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    // Optional: set GOOGLE_SITE_VERIFICATION in env when you add Search Console
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
  },
};

/** Critical styles so a missing CSS chunk never yields a blank white page. */
const CRITICAL_CSS = `
  html{background:#0a0a0a;color-scheme:dark}
  body{margin:0;min-height:100vh;background:#0a0a0a;color:#f2f2f2;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  a{color:inherit}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider>
          {children}
          <VisitorBeacon />
          <Toaster position="bottom-right" richColors closeButton />
        </I18nProvider>
      </body>
    </html>
  );
}
