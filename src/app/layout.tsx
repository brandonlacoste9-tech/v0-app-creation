import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://www.shipboard.ca"
  ),
  title: {
    default: "Shipboard — Describe the idea. Get the UI.",
    template: "%s · Shipboard",
  },
  description:
    "Shipboard is an AI UI builder for developers. Turn product ideas into production React + Tailwind — live preview, iterate in chat, export or push to GitHub.",
  icons: {
    icon: [{ url: "/shipboard-logo.jpg", type: "image/jpeg" }],
    apple: [{ url: "/shipboard-logo.jpg" }],
    shortcut: "/shipboard-logo.jpg",
  },
  openGraph: {
    title: "Shipboard — Describe the idea. Get the UI.",
    description:
      "AI UI builder for developers. Idea → React + Tailwind → preview → ship.",
    url: "https://www.shipboard.ca",
    siteName: "Shipboard",
    type: "website",
    images: [{ url: "/shipboard-logo.jpg", width: 512, height: 512, alt: "Shipboard" }],
  },
  twitter: {
    card: "summary",
    title: "Shipboard — Describe the idea. Get the UI.",
    description: "Idea → React + Tailwind → preview → GitHub. Built for developers.",
    images: ["/shipboard-logo.jpg"],
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
          <Toaster position="bottom-right" richColors closeButton />
        </I18nProvider>
      </body>
    </html>
  );
}
