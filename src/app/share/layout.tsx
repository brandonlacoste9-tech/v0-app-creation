import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared preview",
  description:
    "Shared Shipboard UI preview — remix into studio or open the builder.",
  openGraph: {
    title: "Shared Shipboard preview",
    description: "View a shared UI and remix it into Shipboard studio.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shared Shipboard preview",
    description: "View a shared UI and remix it into Shipboard studio.",
  },
  robots: { index: false, follow: true },
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
