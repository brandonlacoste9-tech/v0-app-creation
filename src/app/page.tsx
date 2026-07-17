"use client";

import Link from "next/link";
import {
  Zap,
  Sparkles,
  Rocket,
  Layers,
  Eye,
  Share2,
  ArrowRight,
  Check,
  LayoutGrid,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { ShipboardLogo } from "@/components/shipboard-logo";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Describe → UI",
    body: "Chat your idea. Grok ships production React + Tailwind, not lorem ipsum mocks.",
  },
  {
    icon: Eye,
    title: "Watch it build",
    body: "Live build view: file tree, streaming code, and a preview that updates as tokens land.",
  },
  {
    icon: Layers,
    title: "Multi-file projects",
    body: "Navbar, Hero, Pricing as real files — export a full Next.js App Router project.",
  },
  {
    icon: GithubIcon,
    title: "One-click GitHub",
    body: "Authorize once. We create the repo and write package.json, app/, components/, and BETA.md.",
  },
  {
    icon: Rocket,
    title: "Ship to Vercel",
    body: "Deploy checklist after push: Vercel import, env vars, local npm run dev. Production dialect only.",
  },
  {
    icon: Share2,
    title: "Share & remix",
    body: "Copy a preview link or publish to the showcase. Anyone can remix into their studio.",
  },
];

const STEPS = [
  { n: "1", t: "Prompt", d: "Idea, template, or iterate in chat" },
  { n: "2", t: "Preview", d: "Live build + interactive iframe" },
  { n: "3", t: "Ship", d: "GitHub push · ZIP · Vercel" },
];

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-1.5">
            <ShipboardLogo size="sm" priority />
            <span className="text-sm font-bold uppercase tracking-tighter">Shipboard</span>
            <span className="ml-1 rounded border border-border px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
              BETA
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <Link href="/gallery" className="hover:text-foreground">
              Showcase
            </Link>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/studio"
              className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              Open studio
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-orange-400"
            >
              Start free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 md:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.12),_transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-400">
            For developers shipping ideas
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Describe the idea.{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
              Get the UI.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Shipboard turns chat into production React + Tailwind: live preview, multi-file projects,
            and one-click GitHub. Powered by Grok. Built for people who ship.
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
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free: 5 gens/day · Builder 40 · Pro 120 · Max unlimited · CAD
          </p>
        </div>

        {/* Product mock */}
        <div className="relative mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-3 font-mono text-[10px] text-muted-foreground">
              studio · building src/Component.tsx
            </span>
          </div>
          <div className="grid md:grid-cols-[1fr_1.4fr]">
            <div className="border-b border-border p-4 md:border-b-0 md:border-r">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Chat
              </p>
              <div className="mt-3 rounded-lg border border-border bg-background p-3 text-left text-xs text-muted-foreground">
                SaaS waitlist with dark hero, email success state, and pricing…
              </div>
              <div className="mt-3 space-y-1.5">
                {["Connect", "Plan", "Scaffold", "Write", "Style"].map((s, i) => (
                  <div
                    key={s}
                    className="flex items-center gap-2 text-[11px] text-muted-foreground"
                  >
                    <Check className="h-3 w-3 text-emerald" />
                    <span className={i === 4 ? "text-orange-300" : ""}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-950 p-6 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Live preview
              </p>
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-xs text-indigo-400">Private beta</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
                  AI that builds with you
                </h2>
                <p className="mt-2 text-sm text-zinc-400">Join the waitlist for early access.</p>
                <div className="mt-4 flex gap-2">
                  <div className="flex h-9 flex-1 items-center rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs text-zinc-500">
                    you@company.com
                  </div>
                  <div className="flex h-9 items-center rounded-lg bg-zinc-100 px-4 text-xs font-semibold text-zinc-900">
                    Join waitlist
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-t border-border bg-card/30 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-border bg-background p-6 text-center"
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 font-bold text-orange-400">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            Everything between idea and ship
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-orange-500/30"
              >
                <f.icon className="h-5 w-5 text-orange-400" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-card/30 px-4 py-16">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Pricing</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Free to start. Builder, Pro, or Max — billed monthly in CAD. Preview is free;
            you pay for generations and ship real Next.js you own.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-left">
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold text-zinc-50">Free</h3>
              <p className="mt-2 text-3xl font-bold text-zinc-50">
                $0<span className="text-sm font-normal text-zinc-400">/mo</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-300">
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> 5 generations / day</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> 3 projects</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Free models</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> GitHub push + ZIP</li>
              </ul>
              <Link href="/studio" className="mt-6 block rounded-xl border border-zinc-600 py-2.5 text-center text-sm font-semibold text-zinc-100 hover:bg-zinc-800">
                Start free
              </Link>
            </div>
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Builder</p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-50">Ship starters</h3>
              <p className="mt-2 text-3xl font-bold text-zinc-50">
                $15<span className="text-sm font-normal text-zinc-400">/mo CAD</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-300">
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> 40 generations / day</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Unlimited projects</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Grok / Groq / Ollama / OpenAI</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> GitHub push + Ship</li>
              </ul>
              <Link href="/studio" className="mt-6 block rounded-xl border border-sky-500/50 py-2.5 text-center text-sm font-semibold text-sky-100 hover:bg-sky-500/10">
                Choose Builder
              </Link>
            </div>
            <div className="rounded-2xl border-2 border-emerald-500/60 bg-zinc-900 p-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Pro · Popular</p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-50">Daily shipping</h3>
              <p className="mt-2 text-3xl font-bold text-zinc-50">
                $25<span className="text-sm font-normal text-zinc-400">/mo CAD</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-300">
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> 120 generations / day</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> All AI providers</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Brand kit</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Version compare</li>
              </ul>
              <Link href="/studio" className="mt-6 block rounded-xl bg-emerald-500 py-2.5 text-center text-sm font-bold text-zinc-950 hover:bg-emerald-400">
                Choose Pro
              </Link>
            </div>
            <div className="rounded-2xl border border-amber-500/40 bg-zinc-900 p-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Max</p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-50">Best quality</h3>
              <p className="mt-2 text-3xl font-bold text-zinc-50">
                $45<span className="text-sm font-normal text-zinc-400">/mo CAD</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-300">
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Unlimited generations</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> All Pro features</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> All AI providers</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Priority support path</li>
              </ul>
              <Link href="/studio" className="mt-6 block rounded-xl border border-amber-500/50 bg-amber-500/10 py-2.5 text-center text-sm font-semibold text-amber-100 hover:bg-amber-500/20">
                Choose Max
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent px-6 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Stop mocking. Start shipping.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Open the studio, describe what you&apos;re building, watch it build live, and push a real project to GitHub.
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

      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>Shipboard · for developers</span>
          </div>
          <div className="flex gap-4">
            <Link href="/studio" className="hover:text-foreground">
              Studio
            </Link>
            <Link href="/gallery" className="hover:text-foreground">
              Showcase
            </Link>
            <a href="https://www.Shipboard.ca" className="hover:text-foreground">
              Shipboard.ca
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
