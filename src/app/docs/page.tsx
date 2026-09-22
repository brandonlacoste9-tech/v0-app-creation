import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipboard Docs — Golden Path, BYOB, Ship, Cursor",
  description:
    "Shipboard documentation for beta: golden-path recipes, BYOB database connect, ship readiness, GitHub eject, Netlify deploy, and continuing in Cursor.",
  keywords: [
    "Shipboard docs",
    "BYOB Neon Supabase",
    "Shipboard golden path",
    "AI Next.js eject",
    "Shipboard GitHub push",
  ],
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Shipboard Docs",
    description:
      "How to generate production UI, connect your DB, and ship real Next.js.",
    url: "/docs",
    type: "website",
  },
};

const site = getSiteUrl();

const sections = [
  {
    id: "overview",
    title: "What is Shipboard?",
    body: `Shipboard is an AI compiler for developers. You describe a product surface in chat; it generates multi-file React + Tailwind + TypeScript oriented toward Next.js App Router. Live preview is a projection of that source. The product is eject: GitHub, ZIP, or Netlify — code you own.`,
  },
  {
    id: "golden-path",
    title: "Golden path recipes",
    body: `In the studio empty state, use Admin Users, Auth Screens, Kanban, or Agent-ready store. Admin/Auth/Kanban import @/app/actions with a production dialect so preview can mock Server Actions while eject emits real action modules when BYOB is connected. Agent-ready store ejects a typed catalog plus /.well-known/ucp, MCP, Stripe, and channel= orders — same Ready to ship gate.`,
  },
  {
    id: "byob",
    title: "BYOB (Bring Your Own Backend)",
    body: `Settings → Database: paste a Neon or Supabase Postgres connection string. Shipboard runs read-only introspection on that request. The schema map (table names, columns, and foreign keys) is stored in this browser only — localStorage key Shipboard.studio.settings.v1. It is not uploaded to Shipboard servers. The connection string is used for a single read-only introspect request and is not persisted. Database rows are never copied. After clone: cp .env.example .env.local and set DATABASE_URL.`,
  },
  {
    id: "ship-readiness",
    title: "Ship readiness",
    body: `The studio toolbar shows Ready to ship, Needs Continue, or Building. Truncated or stub code is blocked from GitHub/ZIP/Netlify — click Continue to finish. Complete code with @/app/actions may warn if no BYOB is connected — still shippable, but set DATABASE_URL for real data.`,
  },
  {
    id: "changes",
    title: "Iteration diffs (Changes tab)",
    body: `After a generation or Continue, open Changes to see files added/modified and a unified diff vs the previous version (or base). Jump to Code or copy hunks. Non-destructive review before push.`,
  },
  {
    id: "cursor",
    title: "Continue in Cursor",
    body: `Push to GitHub or download ZIP, open the folder in Cursor (cursor .), install deps, run the Next dev server, and extend with your agent. See /for-cursor for the full workflow.`,
  },
  {
    id: "limits",
    title: "Plans & limits",
    body: `Free: 5 generations/day, 3 projects. Builder $15 CAD (40/day). Pro $25 CAD (120/day). Max $45 CAD (unlimited). Paid checkout is Stripe after GitHub or Google sign-in. A promo code, if you have one, maps to Pro — enter it in the upgrade dialog. Max priority support is hello@shipboard.ca. See /pricing and /contact.`,
  },
  {
    id: "studio-tools",
    title: "Studio tools (scrape + Imagine)",
    body: `If you paste a public https URL, Shipboard fetches the HTML and injects printed facts (title, headings, emails, phones, hours-like lines) before generating. On Grok (xAI) or OpenAI the model can also call scrape_url and generate_image (Grok Imagine). Rebuild from URL is a golden path: it will not invent emails, hours, or prices that were not on the page. Generated stills are not real staff photos. Localhost and private IPs are blocked.`,
  },
  {
    id: "agent-ready-store",
    title: "Agent-ready store (golden path)",
    body: `Studio empty state → Agent-ready store. One typed catalog (title, description, images, price, inventory, GTIN, brand, policy URLs) drives the human storefront and the machine profile. Eject (same Ready to ship gate) adds public/.well-known/ucp declaring dev.ucp.shopping over REST + MCP, four MCP tools (search_products, get_product, create_checkout_session, get_order), Stripe Checkout for humans, an ACP checkout-session stub that logs the Shared Payment Token, and an orders table with channel=chatgpt|gemini|copilot|human plus /admin/orders. No Shopify account. Deploy on Netlify.`,
  },
];

export default function DocsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Shipboard documentation",
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME, url: site },
    mainEntityOfPage: `${site}/docs`,
    description: metadata.description,
  };

  return (
    <MarketingPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Public beta docs for developers using Shipboard as an AI UI builder and
          Next.js generator. For machine-readable context see{" "}
          <Link href="/llms.txt" className="text-orange-400 hover:underline">
            llms.txt
          </Link>
          .
        </p>

        <nav className="mt-8 rounded-xl border border-border bg-card/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            On this page
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-orange-400/90 hover:text-orange-400 hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-6 text-center">
          <p className="text-sm font-semibold">Ready to try?</p>
          <Link
            href="/studio"
            className="mt-3 inline-block rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400"
          >
            Open studio
          </Link>
        </div>
      </main>
    </MarketingPageShell>
  );
}
