import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-page-shell";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Shipboard is an AI compiler for developers: chat → React + Tailwind + TypeScript → live preview → GitHub / Netlify eject.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Shipboard",
    description:
      "AI compiler for developers. Eject real Next.js. Finish in Cursor.",
    url: "/about",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <MarketingPageShell>
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Public beta
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">About</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {SITE_NAME} is an AI compiler for developers. You describe a product
          surface in chat. It generates production React, Tailwind, and
          TypeScript aimed at Next.js App Router. Live preview is a projection
          of that source. The product is eject — GitHub, ZIP, or Netlify —
          code you own, finished in Cursor or VS Code.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          We are not a no-code cage, not a Shopify admin, and not a consumer
          shopping agent. Phase two is the agent-ready store golden path: one
          catalog that a human can buy from and an agent can read, without a
          Shopify account.
        </p>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Where to go</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <Link href="/studio" className="text-orange-400 hover:underline">
                Studio
              </Link>{" "}
              — generate
            </li>
            <li>
              <Link href="/docs" className="text-orange-400 hover:underline">
                Docs
              </Link>{" "}
              — golden path, BYOB, ship gate, agent-ready store
            </li>
            <li>
              <Link href="/pricing" className="text-orange-400 hover:underline">
                Pricing
              </Link>{" "}
              — CAD, Stripe, promo → Pro
            </li>
            <li>
              <Link href="/contact" className="text-orange-400 hover:underline">
                Contact
              </Link>{" "}
              — {SUPPORT_EMAIL}
            </li>
          </ul>
        </section>
      </main>
    </MarketingPageShell>
  );
}
