import type { Metadata } from "next";
import { Check } from "lucide-react";
import {
  MarketingCta,
  MarketingPageShell,
} from "@/components/marketing-page-shell";
import { PricingGrid } from "@/components/pricing-grid";
import { marketingTiers } from "@/lib/plans";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing — Free, Builder $15, Pro $25, Max $45 (CAD)",
  description:
    "Shipboard public-beta pricing in CAD: Free 5 gens/day, Builder $15, Pro $25, Max $45. AI UI builder for developers — generate Next.js, ship to GitHub.",
  keywords: [
    "Shipboard pricing",
    "AI UI builder pricing",
    "AI Next.js generator cost",
    "v0 alternative pricing",
  ],
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Shipboard pricing",
    description:
      "Free, Builder $15, Pro $25, and Max $45 CAD for the AI compiler that ejects real Next.js.",
    url: "/pricing",
    type: "website",
  },
};

const site = getSiteUrl();

export default function PricingPage() {
  const tiers = marketingTiers();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: SITE_NAME,
    description:
      "AI UI builder for developers — production React, Tailwind, Next.js eject.",
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: tiers.map((t) => ({
      "@type": "Offer",
      name: t.name,
      price: String(t.priceCad),
      priceCurrency: "CAD",
      url: `${site}/pricing`,
      availability: "https://schema.org/InStock",
    })),
  };

  return (
    <MarketingPageShell maxWidth="max-w-6xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-6xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Pricing · CAD
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Simple plans for shipping real code
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Shipboard is an AI UI builder for developers — not a no-code cage.
          Start free, then checkout Builder, Pro, or Max when you need more
          generations. Cancel anytime. Public beta.
        </p>
        <MarketingCta
          primary="Start free"
          secondary="How it works"
          secondaryHref="/docs"
        />

        <PricingGrid className="mt-12" />

        <section className="mt-14 max-w-2xl">
          <h2 className="text-xl font-semibold">What&apos;s included on every plan</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {[
              "Production React + Tailwind + TypeScript generation",
              "Live preview of production-dialect sources",
              "BYOB Postgres (Neon / Supabase) schema mapping",
              "Ship readiness checks before GitHub / ZIP",
              "Iteration diffs (Changes tab)",
              "Eject for Cursor / VS Code — no proprietary runtime",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </MarketingPageShell>
  );
}
