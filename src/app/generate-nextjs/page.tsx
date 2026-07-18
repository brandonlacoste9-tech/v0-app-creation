import type { Metadata } from "next";
import Link from "next/link";
import { Check, Terminal } from "lucide-react";
import {
  MarketingCta,
  MarketingPageShell,
} from "@/components/marketing-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Next.js Generator — App Router UI You Can Eject",
  description:
    "Generate Next.js App Router UI with AI: React, Tailwind, TypeScript, optional Drizzle Server Actions from your Neon/Supabase schema. Shipboard is an AI Next.js generator for developers who push to GitHub and finish in Cursor.",
  keywords: [
    "AI Next.js generator",
    "generate Next.js App Router",
    "AI Next.js UI",
    "Next.js code generator AI",
    "chat to Next.js",
    "AI generate React Tailwind TypeScript",
  ],
  alternates: { canonical: "/generate-nextjs" },
  openGraph: {
    title: "AI Next.js generator — Shipboard",
    description:
      "Chat → production App Router UI → GitHub. Finish in Cursor.",
    url: "/generate-nextjs",
    type: "website",
  },
};

const site = getSiteUrl();

const PAGE_DESCRIPTION =
  "Generate Next.js App Router UI with AI: React, Tailwind, TypeScript, optional Drizzle Server Actions from your Neon/Supabase schema. Shipboard is an AI Next.js generator for developers who push to GitHub and finish in Cursor.";

export default function GenerateNextjsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Generate a Next.js UI with Shipboard",
    description: PAGE_DESCRIPTION,
    step: [
      {
        "@type": "HowToStep",
        name: "Open studio",
        text: "Sign in and open the Shipboard studio.",
      },
      {
        "@type": "HowToStep",
        name: "Prompt or golden path",
        text: "Use Admin Users, Auth Screens, Kanban, or a free-form prompt.",
      },
      {
        "@type": "HowToStep",
        name: "Preview and iterate",
        text: "Confirm live preview and use Changes for diffs.",
      },
      {
        "@type": "HowToStep",
        name: "Ship",
        text: "Push to GitHub or ZIP, then open in Cursor.",
      },
    ],
    tool: { "@type": "HowToTool", name: SITE_NAME },
    url: `${site}/generate-nextjs`,
  };

  return (
    <MarketingPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          AI Next.js generator
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Generate Next.js App Router UI with AI — then own it
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Shipboard generates production-oriented React + Tailwind + TypeScript
          for modern Next.js workflows. Preview in the browser, connect{" "}
          <Link href="/byob" className="text-orange-400 hover:underline">
            your Postgres
          </Link>
          , and eject a project you run with{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[12px]">
            npm run dev
          </code>
          .
        </p>
        <MarketingCta primary="Generate in studio" />

        <section className="mt-14">
          <h2 className="text-xl font-semibold">What you get</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {[
              "Multi-file UI sources aimed at App Router projects",
              "Production dialect imports (@/app/actions) with preview intercept",
              "Optional Drizzle + Server Actions when BYOB is connected",
              "Ship readiness so truncated code does not fake a successful push",
              "Cursor-ready folder structure after GitHub or ZIP",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-card/50 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Terminal className="h-5 w-5 text-orange-400" />
            After you generate
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

        <p className="mt-10 text-sm text-muted-foreground">
          Also see{" "}
          <Link href="/ai-ui-builder" className="text-orange-400 hover:underline">
            AI UI builder
          </Link>
          ,{" "}
          <Link href="/for-cursor" className="text-orange-400 hover:underline">
            Cursor workflow
          </Link>
          , and{" "}
          <Link href="/vs/v0" className="text-orange-400 hover:underline">
            vs v0
          </Link>
          .
        </p>
      </main>
    </MarketingPageShell>
  );
}
