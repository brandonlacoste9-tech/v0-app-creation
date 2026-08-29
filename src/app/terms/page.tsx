import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-page-shell";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Shipboard public-beta terms: you own ejected Next.js, generation limits apply, CAD pricing via Stripe, cancel anytime.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Shipboard Terms",
    description:
      "Public-beta terms for the AI UI builder that ejects real Next.js.",
    url: "/terms",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <MarketingPageShell>
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Public beta
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Terms</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {SITE_NAME} is in public beta. The product will change. These terms
          describe how the studio is meant to be used today.
        </p>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">The product</h2>
          <p>
            Shipboard generates React, Tailwind, and TypeScript aimed at Next.js
            App Router. Preview is a projection of that source. You may push or
            ZIP a project and keep it. Ejected apps are ordinary Next.js — not a
            proprietary runtime you have to keep paying us to run.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Plans</h2>
          <p>
            Free: 5 generations / day and 3 projects. Builder $15 CAD / month
            (40 gens/day). Pro $25 CAD / month (120 gens/day). Max $45 CAD /
            month (unlimited gens). Cancel anytime in Stripe. Entitlements are
            listed on{" "}
            <Link href="/pricing" className="text-orange-400 hover:underline">
              Pricing
            </Link>
            . A promo code, if you have one, maps to Pro.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Your code</h2>
          <p>
            You are responsible for what you generate and ship: licenses,
            secrets in prompts, and whether the output is fit for production.
            Beta generations can be truncated or wrong — use Continue, review
            Changes, and finish in Cursor or VS Code.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Acceptable use</h2>
          <p>
            Do not use Shipboard to attack systems, generate malware, or
            impersonate other products. GitHub OAuth requests repo scope so you
            can push; only connect accounts you own.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">No warranty</h2>
          <p>
            The service is provided as-is during beta. We may rate-limit, change
            models, or pause features. See{" "}
            <Link href="/privacy" className="text-orange-400 hover:underline">
              Privacy
            </Link>{" "}
            for data handling.
          </p>
        </section>
      </main>
    </MarketingPageShell>
  );
}
