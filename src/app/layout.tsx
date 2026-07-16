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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
