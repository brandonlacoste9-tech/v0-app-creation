import type { Metadata } from "next";
import { Check } from "lucide-react";
import {
  MarketingCta,
  MarketingPageShell,
} from "@/components/marketing-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipboard vs v0 — AI UI Builder Built for Eject",
  description:
    "Comparing Shipboard and v0: Shipboard optimizes for multi-file Next.js eject, BYOB Server Actions, ship readiness, iteration diffs, and finishing in Cursor — a v0 alternative for developers who own the repo.",
  keywords: [
    "v0 alternative",
    "Shipboard vs v0",
    "v0 vs Shipboard",
    "AI UI builder eject",
    "v0 Next.js alternative",
  ],
  alternates: { canonical: "/vs/v0" },
  openGraph: {
    title: "Shipboard vs v0",
    description:
      "Eject-first AI UI generation for developers. Production dialect, GitHub ship, Cursor-ready.",
    url: "/vs/v0",
    type: "website",
  },
};

const site = getSiteUrl();

const PAGE_DESCRIPTION =
  "Comparing Shipboard and v0: Shipboard optimizes for multi-file Next.js eject, BYOB Server Actions, ship readiness, iteration diffs, and finishing in Cursor — a v0 alternative for developers who own the repo.";

const ROWS = [
  {
    topic: "Primary job",
    shipboard: "Generate production UI you eject and own",
    other: "Fast UI generation inside a managed experience",
  },
  {
    topic: "Output",
    shipboard: "Multi-file React + Tailwind + TS oriented to App Router",
    other: "Strong component generation; workflow varies by product surface",
  },
  {
    topic: "Database",
    shipboard: "BYOB Neon/Supabase → Drizzle + Server Actions on ship",
    other: "Integrations differ; not the same BYOB eject story",
  },
  {
    topic: "Iteration",
    shipboard: "Changes tab: file list + unified diff per version",
    other: "Chat iteration; diff UX is product-specific",
  },
  {
    topic: "IDE handoff",
    shipboard: "Designed for Cursor / VS Code after GitHub or ZIP",
    other: "Export paths exist; Shipboard optimizes for this handoff",
  },
  {
    topic: "Ship checks",
    shipboard: "Ready / Not ready / truncated guards before push",
    other: "Varies",
  },
] as const;

export default function VsV0Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Shipboard vs v0",
    url: `${site}/vs/v0`,
    description: PAGE_DESCRIPTION,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: site },
  };

  return (
    <MarketingPageShell maxWidth="max-w-4xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-4xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Comparison
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Shipboard vs v0
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Looking for a <strong className="text-foreground">v0 alternative</strong>{" "}
          that treats eject as the product? Shipboard is an AI UI builder for
          developers who want production-dialect Next.js, BYOB backends, and a
          clean path into Cursor — not a second proprietary runtime.
        </p>
        <MarketingCta />

        <div className="mt-12 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border bg-card/80 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Topic</th>
                <th className="px-4 py-3 font-semibold text-orange-400">
                  Shipboard
                </th>
                <th className="px-4 py-3 font-semibold">v0 (typical)</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.topic} className="border-b border-border/80">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.topic}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.shipboard}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">When to pick Shipboard</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {[
              "You already live in Cursor or VS Code",
              "You want GitHub-first ownership of generated code",
              "You use Neon or Supabase and want Server Actions on eject",
              "You care about ship readiness and iteration diffs before push",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Fair use: v0 is a product of Vercel. This page describes Shipboard&apos;s
          positioning for developers evaluating AI UI builders — not an official
          Vercel comparison.
        </p>
      </main>
    </MarketingPageShell>
  );
}
