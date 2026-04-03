"use client"

import Link from "next/link"
import { ArrowRight, Zap, Lock, Layers, Code2, Sparkles, GitBranch } from "lucide-react"

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-Powered Generation",
    desc: "Describe what you want in plain English. Get production-ready React, Next.js, and Tailwind code instantly.",
  },
  {
    icon: Layers,
    title: "Live Preview",
    desc: "See your UI render in real time as the AI writes code. Iterate in seconds, not hours.",
  },
  {
    icon: Code2,
    title: "Full Code Export",
    desc: "Own your code completely. Export clean, readable TypeScript with shadcn/ui components.",
  },
  {
    icon: GitBranch,
    title: "Version History",
    desc: "Every generation is saved. Jump back to any version with one click.",
  },
  {
    icon: Zap,
    title: "Multiple AI Models",
    desc: "Choose from GPT-4o, Claude 3.5, Grok, and Groq — each optimised for different tasks.",
  },
  {
    icon: Lock,
    title: "Secure by Default",
    desc: "Your projects are private. Full auth with secure session management and password hashing.",
  },
]

const EXAMPLES = [
  "A SaaS dashboard with analytics charts and a sidebar",
  "A landing page for a mobile app with pricing section",
  "A Kanban board with drag-and-drop cards",
  "A multi-step checkout form with validation",
  "A dark-mode blog with MDX support",
  "A real-time chat UI with message bubbles",
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <header className="border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold text-base tracking-tight text-foreground">adgenai</span>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Features</Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</Link>
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
            <Link
              href="/sign-up"
              className="flex items-center gap-1.5 h-8 px-3 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
            >
              Get started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-foreground inline-block" />
          Now with Grok 3 and Claude 3.5 Sonnet
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-foreground text-balance leading-[1.05] mb-6">
          Build UI with AI.
          <br />
          <span className="text-muted-foreground">Ship in minutes.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed text-balance">
          Describe what you want to build. adgenai writes the code, renders a live preview, and lets you export production-ready components instantly.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/sign-up"
            className="flex items-center gap-2 h-11 px-6 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Start building free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/sign-in"
            className="flex items-center gap-2 h-11 px-6 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-accent transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Free — 10 generations/month. No credit card required.</p>
      </section>

      {/* Example prompts marquee */}
      <section className="border-y border-border/40 py-5 overflow-hidden">
        <div className="flex gap-3 animate-[marquee_30s_linear_infinite] w-max">
          {[...EXAMPLES, ...EXAMPLES].map((ex, i) => (
            <Link
              key={i}
              href="/sign-up"
              className="shrink-0 px-4 py-2 rounded-full border border-border bg-secondary text-secondary-foreground text-sm hover:border-ring transition-colors"
            >
              {ex}
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-foreground text-balance">Everything you need to ship faster</h2>
          <p className="mt-3 text-muted-foreground text-balance">From idea to production-ready UI in a single prompt.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-6 rounded-xl border border-border bg-card hover:border-ring/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <Icon className="w-4.5 h-4.5 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-foreground">Simple pricing</h2>
          <p className="mt-3 text-muted-foreground">Start free. Scale when you need to.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            {
              name: "Free",
              price: "$0",
              period: "forever",
              features: ["10 generations / month", "GPT-4o Mini", "Live preview", "Code export"],
              cta: "Get started",
              href: "/sign-up",
              highlight: false,
            },
            {
              name: "Pro",
              price: "$20",
              period: "per month",
              features: ["500 generations / month", "All AI models", "Version history", "Priority support"],
              cta: "Start free trial",
              href: "/sign-up",
              highlight: true,
            },
            {
              name: "Unlimited",
              price: "$50",
              period: "per month",
              features: ["Unlimited generations", "All AI models", "Priority access", "Early features"],
              cta: "Get unlimited",
              href: "/sign-up",
              highlight: false,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`p-6 rounded-xl border flex flex-col gap-5 ${
                plan.highlight
                  ? "border-foreground/40 bg-card"
                  : "border-border bg-card"
              }`}
            >
              <div>
                {plan.highlight && (
                  <span className="inline-block mb-3 px-2 py-0.5 text-[10px] font-semibold bg-foreground text-background rounded">
                    POPULAR
                  </span>
                )}
                <div className="text-sm font-medium text-muted-foreground">{plan.name}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`h-9 flex items-center justify-center rounded-md text-sm font-medium transition-opacity hover:opacity-80 ${
                  plan.highlight
                    ? "bg-foreground text-background"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm font-semibold text-foreground">adgenai</span>
          <p className="text-xs text-muted-foreground">Built with Next.js, shadcn/ui, and the Vercel AI SDK.</p>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/sign-up" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
