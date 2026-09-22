import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-page-shell";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Dated notes on Shipboard: P0/P1 hygiene and the agent-ready store golden path. Static page, no CMS.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog · Shipboard",
    description:
      "P0/P1 site debt and the agent-ready store golden path. Dated entries, no CMS.",
    url: "/changelog",
    type: "website",
  },
};

const ENTRIES: { date: string; title: string; items: string[] }[] = [
  {
    date: "2026-09-22",
    title: "Storefront visual bar",
    items: [
      "Three storefront-first styles on /studio/new-store: Clean (Dawn-level restraint), Atelier (serif, earth), Street (heavy type). Each recipe is a full shop anatomy — announcement → sticky header → one-message hero → numbered collection on a contrast band → editorial → trust → newsletter → footer.",
      "Product cards are 4:5 with hover, formatMoney, 01/02/03 indexes, and a left/right detail panel. Fake ★★★★★ reviews, SALE spam, and hero carousels are banned.",
      "Contrast band is copy-paste classes: store-contrast w-full bg-zinc-950 (clean) / bg-[#1C1917] (atelier) / bg-black (street) plus py-20 md:py-28, inner store-contrast-inner mx-auto max-w-7xl px-6.",
      "Preview merge drops leftover .formatMoney tails per file without rebalancing JSX (rebalance was closing functions early → return outside of function). Typed const PRODUCTS: T[] = is extracted so merchant SKUs replace the Northline default catalog.",
      "Cheapest real-photo path is the existing Grok Imagine tool (generate_image) — no third-party API. Until a still returns, one coherent inline-SVG language in reserved 4:5 slots.",
      "QA score is static+live: an empty/black preview or a compile error cannot grade Good. Chat score updates when the iframe reports mount/fail. Bare `\"sku\": <svg>` object entries are rewritten per file (not global brace-depth) and fail static QA. Eject catalog.ts uses the merchant PRODUCTS, not Northline $28. Fix-from-QA must not claim the preview compiles — Babel is the gate.",
    ],
  },
  {
    date: "2026-09-22",
    title: "Start a store",
    items: [
      "Guided rail at /studio/new-store: name, products, vibe. Lands in the studio with v1 generating — merchant SKUs, not placeholder SVGs.",
      "Preview iframe installs formatMoney / getProduct / createCheckoutSession on window before user code runs (wizard ProductGrid calls window.formatMoney).",
      "Toolbar Preview blocked / Publish-disabled clears on a successful iframe paint — stale compile errors no longer stick after the storefront renders.",
      "ACP/MCP/UCP and durable store_orders still attach on eject. The general chat builder is unchanged.",
    ],
  },
  {
    date: "2026-09-22",
    title: "Compiler, not a template grid",
    items: [
      "One golden path: Agent-ready store. Admin / Auth / Kanban are ordinary chips.",
      "Ejected stores write store_orders to Postgres when DATABASE_URL is set (same shape as Northline). Memory fallback only without it.",
      "Canonical origin is shipboard.ca. shipboard.netlify.app 308s there.",
    ],
  },
  {
    date: "2026-09-22",
    title: "Store preview: one PRODUCTS binding",
    items: [
      "Platform catalog is injected once. Generated const PRODUCTS / lib/catalog.ts copies are stripped so Babel no longer throws “already been declared”.",
      "Eject-only files (ACP / MCP / UCP routes) stay out of the iframe merge and the iterate prompt, so body.line_items cannot truncate Component.tsx.",
      "Ready-to-ship goes red when the iframe fails to compile. Continue is a no-op unless the stream was actually truncated.",
    ],
  },
  {
    date: "2026-09-22",
    title: "Golden path: store that actually renders",
    items: [
      "Agent-ready store no longer crashes on first paint: PRODUCTS is injected when the model forgets the catalog.",
      "QA fails Ready-to-ship on runtime exceptions. A store that throws never ships.",
      "Generated v1 now includes the agent stack (catalog, /.well-known/ucp, MCP tools, Stripe, ACP stub, channel=).",
      "The golden-path card fills the prompt — hit Send. No silent project burn.",
    ],
  },
  {
    date: "2026-09-22",
    title: "Agent-ready store",
    items: [
      "Studio prompt Agent-ready store. Same Ready-to-ship gate.",
      "Eject includes a typed catalog, /.well-known/ucp (dev.ucp.shopping over REST + MCP), four MCP tools (search_products, get_product, create_checkout_session, get_order), Stripe Checkout for humans, ACP stub, and orders.channel = chatgpt | gemini | copilot | human.",
      "Proof-of-concept store is live at northline-supply.netlify.app — not a real brand. Admin shows the last 20 orders.",
    ],
  },
  {
    date: "2026-09-22",
    title: "Public log",
    items: [
      "This page. Dated entries, listed in the sitemap and the footer. Static — no CMS.",
    ],
  },
  {
    date: "2026-09-22",
    title: "P0 / P1 hygiene",
    items: [
      "Dead discord.gg link removed from studio. Contact is /contact. No public Discord.",
      "Eject target is Netlify. Vercel stays a secondary import in the deploy dialog only.",
      "BYOB schema map is browser localStorage (Shipboard.studio.settings.v1). Connection string is request-scoped.",
      "Ollama is labeled as your machine, not hosted. Gallery titles no longer truncate mid-word. Promo → Pro already existed. Max priority support: hello@shipboard.ca.",
      "/about and /contact added.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <MarketingPageShell>
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Public beta
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Changelog</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Dated notes. One static page — no CMS. For contact, use{" "}
          <Link href="/contact" className="text-orange-400 hover:underline">
            /contact
          </Link>
          .
        </p>

        <ol className="mt-10 space-y-10">
          {ENTRIES.map((entry) => (
            <li key={entry.date + entry.title}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <time dateTime={entry.date}>{entry.date}</time>
              </p>
              <h2 className="mt-2 text-lg font-semibold">{entry.title}</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </main>
    </MarketingPageShell>
  );
}
