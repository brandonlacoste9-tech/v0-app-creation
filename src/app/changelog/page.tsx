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
