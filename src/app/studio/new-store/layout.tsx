import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start a store",
  description:
    "Answer a few questions — store name, products, vibe — and land in the studio with a working storefront.",
  alternates: { canonical: "/studio/new-store" },
  openGraph: {
    title: "Start a store · Shipboard",
    description:
      "Guided rail: name, products, vibe → live agent-ready storefront in the studio.",
    url: "/studio/new-store",
    type: "website",
  },
};

export default function NewStoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
