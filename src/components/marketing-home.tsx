"use client";

import Link from "next/link";
import {
  Zap,
  Sparkles,
  Layers,
  Eye,
  ArrowRight,
  LayoutGrid,
  Database,
  GitCompare,
  Terminal,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing-header";
import { PricingGrid } from "@/components/pricing-grid";
import { StudioProductShot } from "@/components/studio-product-shot";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Describe → production UI",
    body: "Chat your idea. Shipboard generates production React + Tailwind + TypeScript — not throwaway mocks.",
  },
  {
    icon: Eye,
    title: "Calm live build",
    body: "Watch files stream in with a stable build surface, then open a real interactive preview when the source is complete.",
  },
  {
    icon: Layers,
    title: "Multi-file Next.js projects",
    body: "App Router structure you own: components, pages, package.json — export a full project, not a single sandbox file.",
  },
  {
    icon: Database,
    title: "BYOB Postgres",
    body: "Connect Neon or Supabase. Schema-aware generation, mock preview data, Drizzle + Server Actions on eject.",
  },
  {
    icon: GitCompare,
    title: "Iteration diffs",
    body: "See exactly what Continue or a follow-up prompt changed — file list + unified diff before you ship.",
  },
  {
    icon: GithubIcon,
    title: "One-click GitHub + Netlify",
    body: "Push a real repo, deploy checklist, Cursor-ready source. Production dialect only — no dual-path preview lies.",
  },
];

const STEPS = [
  { n: "1", t: "Prompt", d: "Idea, golden-path template, or iterate in chat" },
  { n: "2", t: "Preview", d: "Build surface → interactive UI when ready" },
  { n: "3", t: "Ship", d: "GitHub · ZIP · Netlify · finish in Cursor" },
];

const FAQ = [
  {
    q: "Is Shipboard a no-code tool?",
    a: "No. Shipboard is for developers. It generates production React, Tailwind, and TypeScript you can open in Cursor or VS Code, push to GitHub, and deploy on Netlify (or Vercel).",
  },
  {
    q: "How is Shipboard different from v0?",
    a: "Shipboard optimizes for eject quality: multi-file Next.js App Router projects, BYOB Server Actions, ship readiness checks, and iteration diffs — so you continue in your IDE, not a proprietary runtime.",
  },
  {
    q: "Can I use my own database?",
    a: "Yes. Bring Your Own Backend (BYOB): connect Neon or Supabase for read-only schema mapping. Preview uses mocks; eject includes Drizzle schema and Server Actions. Set DATABASE_URL after clone.",
  },
  {
    q: "Does it work with Cursor?",
    a: "Yes. The intended workflow is generate in Shipboard → push or ZIP → open the folder in Cursor and keep shipping. Ejected code is standard Next.js.",
  },
  {
    q: "Is Shipboard free?",
    a: "Public beta includes a free tier (5 gens/day). Builder $15, Pro $25, and Max $45 CAD raise limits. Full cards are on /pricing.",
  },
];

export function MarketingHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader
        maxWidth="max-w-6xl"
        extra={[
          { href: "#features", label: "Features" },
          { href: "#how", label: "How it works" },
          { href: "#faq", label: "FAQ" },
        ]}
      />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 md:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.12),_transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-400">
              <Zap className="h-3 w-3" />
              Public Beta
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              AI UI builder for developers · Next.js · Cursor-ready
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Describe the idea.{" "}
            <span className="sm:whitespace-nowrap bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
              Get production UI.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Shipboard is an{" "}
            <strong className="font-semibold text-foreground/90">
              AI compiler for developers
            </strong>
            : chat → React + Tailwind + TypeScript → live preview → GitHub.
            Eject real Next.js App Router projects and keep shipping in Cursor.
            We&apos;re in beta — expect rapid improvements.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_-10px_rgba(249,115,22,0.6)] hover:bg-orange-400"
            >
              <Sparkles className="h-4 w-4" />
              Open the studio
            </Link>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:border-orange-500/40"
            >
              <LayoutGrid className="h-4 w-4" />
              Browse showcase
            </Link>
            <Link
              href="/for-cursor"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:border-orange-500/40"
            >
              <Terminal className="h-4 w-4" />
              Cursor workflow
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free: 5 gens/day · Builder 40 · Pro 120 · Max unlimited · CAD
          </p>
        </div>

        <StudioProductShot />
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            Built for people who ship real apps
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
            Not a design toy. An AI UI builder that targets production dialect —
            Next.js App Router, Server Actions, and eject-to-GitHub as the product.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-orange-500/25 bg-orange-500/10">
                  <Icon className="h-4 w-4 text-orange-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="scroll-mt-20 border-y border-border bg-card/30 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            How Shipboard works
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/10 font-mono text-sm font-bold text-orange-400">
                  {s.n}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{s.t}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
            Preview is a projection of production sources. You ship the ejected
            Next.js repo — not a locked runtime.{" "}
            <Link href="/docs" className="text-orange-400 hover:underline">
              Read the docs
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ — SEO + AI search */}
      <section id="faq" className="scroll-mt-20 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            FAQ
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
            Common questions about Shipboard as an AI UI builder for developers.
          </p>
          <dl className="mt-10 space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-border bg-card/50 px-5 py-4"
              >
                <dt className="text-sm font-semibold text-foreground">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        id="pricing"
        className="scroll-mt-20 border-t border-border px-4 py-16"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Simple pricing
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            CAD · cancel anytime · public beta · billed by Stripe
          </p>
          <PricingGrid className="mt-10" />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Free opens the studio. Builder, Pro, and Max go to Stripe checkout
            after you sign in. See{" "}
            <Link href="/docs" className="text-orange-400 hover:underline">
              docs
            </Link>{" "}
            for BYOB.
          </p>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
            Rebuild from a live site
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            Paste a URL. Get production UI.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Shipboard reads printed facts (hours, phone, CTAs) and generates a
            Next.js page you can eject. It will not invent contact details.
          </p>
          <form
            className="mt-6 flex flex-col gap-2 sm:flex-row"
            action="/studio"
            method="get"
          >
            <input
              type="url"
              name="rebuild"
              required
              placeholder="https://example.com"
              className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-orange-500/50"
            />
            <button
              type="submit"
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-400"
            >
              Open in studio
            </button>
          </form>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent px-6 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Stop mocking. Start shipping.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Open the studio, describe what you&apos;re building, watch it build,
            review Changes, and push a real project to GitHub.
          </p>
          <Link
            href="/studio"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_-12px_rgba(249,115,22,0.55)] hover:bg-orange-400"
          >
            Launch studio
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter maxWidth="max-w-6xl" />
    </div>
  );
}
