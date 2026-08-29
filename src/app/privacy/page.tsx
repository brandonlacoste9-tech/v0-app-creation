import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Shipboard collects in public beta: GitHub or Google account, generation history, Stripe customer id, and a BYOB schema map. CAD billing via Stripe.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Shipboard Privacy",
    description: "How Shipboard handles account, generation, and billing data.",
    url: "/privacy",
    type: "website",
  },
};

const site = getSiteUrl();

export default function PrivacyPage() {
  return (
    <MarketingPageShell>
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Public beta
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {SITE_NAME} is a public-beta AI UI builder at{" "}
          <a href={site} className="text-orange-400 hover:underline">
            {site.replace(/^https:\/\//, "")}
          </a>
          . This page describes what the product actually stores today — not a
          generic template.
        </p>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Account</h2>
          <p>
            You can use a limited anonymous session, or sign in with GitHub or
            Google. When you sign in we store username (or name), email if the
            provider sends it, and avatar URL so the studio can show who you are
            and attach a plan.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">
            Prompts and generated code
          </h2>
          <p>
            Chat messages, generated files, and version history live on your
            Shipboard sessions so you can iterate, open Changes, and eject.
            Treat prompts as confidential if they include secrets — do not paste
            production keys into chat.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Billing</h2>
          <p>
            Paid plans (Builder $15, Pro $25, Max $45 CAD / month) checkout on
            Stripe. We store Stripe customer id and plan tier so entitlements
            work. Card numbers are handled by Stripe, not by Shipboard.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">
            BYOB database
          </h2>
          <p>
            If you paste a Neon or Supabase connection string, it is used for a
            read-only schema introspect on that request. What we keep is a
            schema map (table names, columns) in your browser settings — not a
            copy of your database rows. Set <code>DATABASE_URL</code> on your
            own clone after eject.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
          <p>
            Marketing and studio page views may be recorded so we can see which
            public pages are used. We do not sell this to ad networks.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            Questions about this page: open studio and use the signed-in
            account, or see{" "}
            <Link href="/terms" className="text-orange-400 hover:underline">
              Terms
            </Link>
            . Pricing is listed on{" "}
            <Link href="/pricing" className="text-orange-400 hover:underline">
              /pricing
            </Link>
            .
          </p>
        </section>
      </main>
    </MarketingPageShell>
  );
}
