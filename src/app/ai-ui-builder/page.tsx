import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  MarketingCta,
  MarketingPageShell,
} from "@/components/marketing-page-shell";
import { DEFAULT_DESCRIPTION, getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI UI Builder for Developers — Production React & Next.js",
  description:
    "Shipboard is an AI UI builder for developers: chat to production React + Tailwind + TypeScript, live preview, BYOB Postgres, GitHub eject. Not no-code — real Next.js you finish in Cursor.",
  keywords: [
    "AI UI builder",
    "AI UI generator",
    "AI React builder",
    "AI component generator",
    "developer AI UI tool",
    "AI frontend generator",
  ],
  alternates: { canonical: "/ai-ui-builder" },
  openGraph: {
    title: "AI UI builder for developers — Shipboard",
    description: DEFAULT_DESCRIPTION,
    url: "/ai-ui-builder",
    type: "website",
  },
};

const site = getSiteUrl();

const PAGE_DESCRIPTION =
  "Shipboard is an AI UI builder for developers: chat to production React + Tailwind + TypeScript, live preview, BYOB Postgres, GitHub eject. Not no-code — real Next.js you finish in Cursor.";

export default function AiUiBuilderPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: `${site}/ai-ui-builder`,
    description: PAGE_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CAD",
    },
  };

  return (
    <MarketingPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          AI UI builder
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          An AI UI builder that ships code you keep
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Most “AI UI builders” stop at pretty mocks. Shipboard is built for
          software engineers: multi-file production React, Tailwind, and
          TypeScript oriented toward Next.js App Router — with live preview,
          schema-aware BYOB, and one-click GitHub.
        </p>
        <MarketingCta />

        <section className="mt-14">
          <h2 className="text-xl font-semibold">What “AI UI builder” means here</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {[
              "Describe a product surface in chat — admin tables, auth, kanban, dashboards",
              "Get multi-file sources with function Component() entry, not a locked IR",
              "Preview is a projection of production imports (mocked Server Actions)",
              "Iterate with a Changes tab that shows real diffs",
              "Ship when Ready — GitHub, ZIP, or Vercel checklist",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-card/50 p-6">
          <h2 className="text-lg font-semibold">Related guides</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/generate-nextjs" className="text-orange-400 hover:underline">
                AI Next.js generator
              </Link>
            </li>
            <li>
              <Link href="/for-cursor" className="text-orange-400 hover:underline">
                Shipboard for Cursor
              </Link>
            </li>
            <li>
              <Link href="/byob" className="text-orange-400 hover:underline">
                BYOB Neon & Supabase
              </Link>
            </li>
            <li>
              <Link href="/vs/v0" className="text-orange-400 hover:underline">
                Shipboard vs v0
              </Link>
            </li>
          </ul>
        </section>
      </main>
    </MarketingPageShell>
  );
}
