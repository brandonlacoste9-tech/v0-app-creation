import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://capable-medovik-53f769.netlify.app"
  ),
  title: {
    default: "AdGenAI — Describe the idea. Get the UI.",
    template: "%s · AdGenAI",
  },
  description:
    "AI UI builder for developers. Turn product ideas into production React + Tailwind — live preview, iterate in chat, export or push to GitHub. Powered by Grok.",
  openGraph: {
    title: "AdGenAI — Describe the idea. Get the UI.",
    description:
      "AI UI builder for developers. Idea → React + Tailwind → preview → ship.",
    url: "https://capable-medovik-53f769.netlify.app",
    siteName: "AdGenAI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AdGenAI — Describe the idea. Get the UI.",
    description: "Idea → React + Tailwind → preview → GitHub. Built for developers.",
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
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
