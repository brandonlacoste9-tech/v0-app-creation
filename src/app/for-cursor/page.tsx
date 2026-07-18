import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Terminal } from "lucide-react";
import { DEFAULT_DESCRIPTION, getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipboard for Cursor — AI Next.js Foundations You Finish in Your IDE",
  description:
    "Use Shipboard with Cursor: generate production Next.js App Router + Tailwind, review diffs, push to GitHub, then open the repo in Cursor. Complementary workflow for AI IDE power users.",
  keywords: [
    "Cursor AI",
    "Cursor Next.js",
    "AI generate Next.js for Cursor",
    "Shipboard Cursor",
    "v0 alternative Cursor",
    "eject AI UI to Cursor",
  ],
  alternates: { canonical: "/for-cursor" },
  openGraph: {
    title: "Shipboard × Cursor",
    description:
      "Shipboard generates production Next.js foundations. Cursor is where you finish products.",
    url: "/for-cursor",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shipboard for Cursor developers",
    description:
      "Generate clean Next.js in Shipboard. Clone and keep building in Cursor.",
  },
};

const site = getSiteUrl();

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Shipboard for Cursor",
  url: `${site}/for-cursor`,
  description:
    "Complementary workflow: Shipboard generates production Next.js; Cursor finishes the product.",
  isPartOf: { "@type": "WebSite", name: SITE_NAME, url: site },
};

export default function ForCursorPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-sm font-bold uppercase tracking-tighter">
            Shipboard
          </Link>
          <Link
            href="/studio"
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400"
          >
            Open studio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          For Cursor & AI-IDE users
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Shipboard generates the foundation.{" "}
          <span className="text-orange-400">Cursor finishes the product.</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {DEFAULT_DESCRIPTION} This page is for developers who live in Cursor
          and want high-quality Next.js eject — not another closed playground.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400"
          >
            Generate in studio
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:border-orange-500/40"
          >
            Read docs
          </Link>
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-semibold">Recommended workflow</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            {[
              "Open Shipboard studio and pick a golden path (Admin Users, Auth, Kanban) or free-form prompt.",
              "Optional: Settings → Database — connect Neon/Supabase for BYOB schema + Drizzle eject.",
              "Iterate in chat; use the Changes tab to see exactly what the last prompt did.",
              "When Ready to ship, Push to GitHub (or ZIP).",
              "In Cursor: clone the repo, cp .env.example .env.local, set DATABASE_URL if needed, npm i && npm run dev.",
              "Ask Cursor to extend Server Actions, tests, Stripe, or design polish — layout is normal Next.js.",
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

        <section className="mt-12 rounded-2xl border border-border bg-card/50 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Terminal className="h-5 w-5 text-orange-400" />
            After eject
          </h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-950 p-4 font-mono text-[12px] text-zinc-300">
{`git clone <your-repo>
cd <repo>
npm install
cp .env.example .env.local
# DATABASE_URL=… if BYOB
cursor .
npm run dev`}
          </pre>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">What Shipboard owns vs Cursor</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {[
              "Shipboard: scaffolding, production-dialect UI, BYOB actions, ship readiness, GitHub push",
              "Cursor: multi-file agent edits, tests, domain logic, integrations, PR workflows",
              "You own the repo — no proprietary runtime lock-in",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          <Link href="/" className="text-orange-400 hover:underline">
            ← Back to homepage
          </Link>
        </p>
      </main>
    </div>
  );
}
