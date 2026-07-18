import type { Metadata } from "next";

/** Studio is the product app — index lightly so marketing pages own rankings. */
export const metadata: Metadata = {
  title: "Studio",
  description:
    "Shipboard studio — chat to production React + Tailwind, live preview, BYOB, ship to GitHub.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/studio",
  },
  openGraph: {
    title: "Shipboard Studio",
    description: "AI compiler workspace for developers.",
    url: "/studio",
  },
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
