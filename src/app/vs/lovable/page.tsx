import type { Metadata } from "next";
import { Check } from "lucide-react";
import {
  MarketingCta,
  MarketingPageShell,
} from "@/components/marketing-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipboard vs Lovable — For Developers Who Eject Next.js",
  description:
    "Shipboard vs Lovable: Shipboard targets developers who want production React/Next.js eject, BYOB Postgres, GitHub ship, and Cursor handoff — a Lovable alternative when you outgrow closed app builders.",
  keywords: [
    "Lovable alternative",
    "Shipboard vs Lovable",
    "Lovable vs Shipboard",
    "AI app builder for developers",
    "eject AI app to GitHub",
  ],
  alternates: { canonical: "/vs/lovable" },
  openGraph: {
    title: "Shipboard vs Lovable",
    description:
      "Developer-first AI UI compiler vs no-code-leaning app builders. Own the Next.js repo.",
    url: "/vs/lovable",
    type: "website",
  },
};

const site = getSiteUrl();

const PAGE_DESCRIPTION =
  "Shipboard vs Lovable: Shipboard targets developers who want production React/Next.js eject, BYOB Postgres, GitHub ship, and Cursor handoff — a Lovable alternative when you outgrow closed app builders.";

const ROWS = [
  {
    topic: "Audience",
    shipboard: "Engineers comfortable with Next.js + Tailwind",
    other: "Builders who want full apps with less code ceremony",
  },
  {
    topic: "Code ownership",
    shipboard: "Eject is the product — standard Next.js you keep",
    other: "Platform + export story varies; often more hosted",
  },
  {
    topic: "Stack bias",
    shipboard: "React 19, Tailwind, TS, App Router, Server Actions",
    other: "Opinionated full-stack generation for rapid apps",
  },
  {
    topic: "Database",
    shipboard: "BYOB Neon/Supabase with schema map + Drizzle eject",
    other: "Built-in backend options common in app builders",
  },
  {
    topic: "IDE",
    shipboard: "Generate → ship → finish in Cursor",
    other: "In-product editing + external tools depending on plan",
  },
] as const;

export default function VsLovablePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Shipboard vs Lovable",
    url: `${site}/vs/lovable`,
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
          Shipboard vs Lovable
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Need a <strong className="text-foreground">Lovable alternative</strong>{" "}
          that assumes you are a developer? Shipboard is an AI compiler: chat an
          idea, preview production-dialect UI, connect your Postgres, and eject
          a repo you open in Cursor.
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
                <th className="px-4 py-3 font-semibold">Lovable (typical)</th>
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
          <h2 className="text-xl font-semibold">Choose Shipboard if…</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {[
              "You want sharp edges: TypeScript, App Router, real Server Actions",
              "You already have Neon or Supabase and refuse locked data planes",
              "GitHub push + Cursor is your default shipping path",
              "You evaluate AI tools by eject quality, not demo polish alone",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Lovable is a third-party product. This page positions Shipboard for
          developer search intent — features change; verify current offerings on
          each vendor&apos;s site.
        </p>
      </main>
    </MarketingPageShell>
  );
}
