import type { Metadata } from "next";
import Link from "next/link";
import { Check, Database } from "lucide-react";
import {
  MarketingCta,
  MarketingPageShell,
} from "@/components/marketing-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "BYOB — Bring Your Own Backend (Neon & Supabase)",
  description:
    "Connect Neon or Supabase to Shipboard. Read-only schema introspection, production Server Actions on eject, mock preview in studio. Your Postgres, your DATABASE_URL.",
  keywords: [
    "BYOB Postgres",
    "AI builder Neon",
    "AI builder Supabase",
    "Drizzle Server Actions AI",
    "Shipboard BYOB",
    "bring your own database AI UI",
  ],
  alternates: { canonical: "/byob" },
  openGraph: {
    title: "Shipboard BYOB — your Neon or Supabase",
    description:
      "Schema-aware AI generation. Preview mocks actions; eject real Drizzle + Server Actions.",
    url: "/byob",
    type: "website",
  },
};

const site = getSiteUrl();

export default function ByobPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Shipboard BYOB",
    url: `${site}/byob`,
    description:
      "Bring your own Neon or Supabase Postgres to Shipboard for schema-aware Next.js generation.",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: site },
  };

  return (
    <MarketingPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Bring Your Own Backend
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Your Postgres.{" "}
          <span className="text-orange-400">Schema-aware AI UI.</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Shipboard connects to <strong className="text-foreground">Neon</strong>{" "}
          or <strong className="text-foreground">Supabase</strong> for a single
          read-only introspection. We map tables and columns so generation and
          eject stay honest — we do not invent schema or store your password for
          later use.
        </p>
        <MarketingCta
          primary="Open studio → Database"
          secondary="Full docs"
          secondaryHref="/docs#byob"
        />

        <section className="mt-14 rounded-2xl border border-border bg-card/50 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5 text-orange-400" />
            How BYOB works
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            {[
              "Settings → Database — paste a postgresql:// connection string",
              "Connect & map schema (information_schema only, read-only)",
              "Studio keeps a schema map — not your live password",
              "Preview mocks @/app/actions so the iframe stays safe",
              "Ship / eject emits Drizzle + Server Actions for your tables",
              "After clone: set DATABASE_URL in .env.local and run npm run dev",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-500/40 font-mono text-[11px] text-orange-400">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Safety guarantees</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {[
              "No auto-migrations into your database",
              "No platform tables injected into your BYOB DB",
              "Connection string used for introspection — not kept as a standing secret on our side",
              "You own the data plane after eject",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 text-sm text-muted-foreground">
          Golden path: connect BYOB, then run{" "}
          <Link href="/docs#golden-path" className="text-orange-400 hover:underline">
            Admin Users
          </Link>{" "}
          so the table uses real column names from your schema.
        </p>
      </main>
    </MarketingPageShell>
  );
}
