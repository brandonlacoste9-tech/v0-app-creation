import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Showcase",
  description:
    "Community and official Shipboard UIs — production React + Tailwind generated in studio. Preview live, remix into your project, ship real Next.js.",
  openGraph: {
    title: "Shipboard Showcase",
    description:
      "Browse production-dialect UIs from Shipboard. Remix into studio or ship to GitHub.",
    url: "/gallery",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shipboard Showcase",
    description: "Community UIs generated with Shipboard — remix and ship.",
  },
  alternates: {
    canonical: "/gallery",
  },
};

export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
