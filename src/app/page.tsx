import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing-home";
import { DEFAULT_DESCRIPTION, getSiteUrl, SEO_KEYWORDS, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — AI UI Builder for Developers | Next.js + Cursor`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} — Describe the idea. Get production UI.`,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI UI builder for developers`,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const site = getSiteUrl();

const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: site,
    description: DEFAULT_DESCRIPTION,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "45",
      priceCurrency: "CAD",
      offerCount: 4,
    },
    featureList: [
      "AI React and Next.js generation",
      "Live preview with production dialect",
      "BYOB Postgres introspection",
      "Iteration diffs",
      "GitHub and Vercel ship",
      "Cursor-ready eject",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: site,
    logo: `${site}/shipboard-logo.jpg`,
    description: DEFAULT_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: site,
    potentialAction: {
      "@type": "SearchAction",
      target: `${site}/gallery?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is Shipboard a no-code tool?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Shipboard is for developers. It generates production React, Tailwind, and TypeScript you can open in Cursor or VS Code, push to GitHub, and deploy on Vercel.",
        },
      },
      {
        "@type": "Question",
        name: "How is Shipboard different from v0?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Shipboard optimizes for eject quality: multi-file Next.js App Router projects, BYOB Server Actions, ship readiness checks, and iteration diffs so you continue in your IDE.",
        },
      },
      {
        "@type": "Question",
        name: "Can I use my own database with Shipboard?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Connect Neon or Supabase for schema mapping. Preview uses mocks; eject includes Drizzle and Server Actions. Set DATABASE_URL after clone.",
        },
      },
      {
        "@type": "Question",
        name: "Does Shipboard work with Cursor?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Generate in Shipboard, push or ZIP, open the folder in Cursor, and keep shipping standard Next.js.",
        },
      },
    ],
  },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <MarketingHome />
    </>
  );
}
