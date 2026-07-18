import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  MarketingCta,
  MarketingPageShell,
} from "@/components/marketing-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing — Free, Builder, Pro (CAD)",
  description:
    "Shipboard pricing for the public beta: Free tier with daily generations, Builder and Pro plans in CAD. AI UI builder for developers — generate Next.js, ship to GitHub.",
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
      "Free, Builder, and Pro plans for the AI compiler that ejects real Next.js.",
    url: "/pricing",
    type: "website",
  },
};

const site = getSiteUrl();

const TIERS = [
  {
    name: "Free",
    price: "0",
    blurb: "Dogfood the golden path",
    perks: [
      "Daily generation limits",
      "Core model providers",
      "GitHub push + ZIP",
      "Live preview + Changes tab",
    ],
  },
  {
    name: "Builder",
    price: "15",
    blurb: "Ship more projects per day",
    perks: [
      "Higher daily gens",
      "Unlimited projects",
      "Share & gallery publish",
      "Priority generation path",
    ],
  },
  {
    name: "Pro",
    price: "29",
    blurb: "Full studio power",
    perks: [
      "Highest free-tier-adjacent caps",
      "All providers",
      "Brand kit",
      "Browser QA tools",
    ],
  },
] as const;

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: SITE_NAME,
    description:
      "AI UI builder for developers — production React, Tailwind, Next.js eject.",
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: TIERS.map((t) => ({
      "@type": "Offer",
      name: t.name,
      price: t.price,
      priceCurrency: "CAD",
      url: `${site}/pricing`,
      availability: "https://schema.org/InStock",
    })),
  };

  return (
    <MarketingPageShell maxWidth="max-w-5xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-5xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Pricing · CAD
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Simple plans for shipping real code
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Shipboard is an AI UI builder for developers — not a no-code cage.
          Start free, upgrade when you need more generations and studio power.
          Cancel anytime. Public beta.
        </p>
        <MarketingCta primary="Start free" secondary="How it works" secondaryHref="/docs" />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                {tier.name}
              </p>
              <p className="mt-2 text-3xl font-bold">
                ${tier.price}
                <span className="text-sm font-normal text-muted-foreground">
                  /mo
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{tier.blurb}</p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {tier.perks.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                href="/studio"
                className="mt-6 block rounded-xl border border-border py-2.5 text-center text-sm font-semibold hover:border-orange-500/40"
              >
                Get started
              </Link>
            </div>
          ))}
        </div>

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
