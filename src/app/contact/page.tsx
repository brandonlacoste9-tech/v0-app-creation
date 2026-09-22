import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-page-shell";
import { SUPPORT_EMAIL, SUPPORT_ISSUES_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Shipboard: hello@shipboard.ca for Max priority support, or GitHub issues for everything else.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Shipboard",
    description: "Email hello@shipboard.ca or open a GitHub issue.",
    url: "/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <MarketingPageShell>
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Support
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Contact</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {SITE_NAME} is a small public-beta product. There is no Discord
          server. Pick the channel that matches the plan.
        </p>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">
            Max — priority support
          </h2>
          <p>
            Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-orange-400 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            . That is the published Max priority path: billing, entitlements,
            and production blockers. We read it before GitHub issues.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">
            Everyone else
          </h2>
          <p>
            Open a GitHub issue on{" "}
            <a
              href={SUPPORT_ISSUES_URL}
              className="text-orange-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              brandonlacoste9-tech/v0-app-creation
            </a>
            . Bugs, golden-path gaps, and eject failures belong there.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">
            What we will not invent
          </h2>
          <p>
            No live Discord invite (the old studio link was a bare discord.gg
            with no server). No phone number. For privacy and terms see{" "}
            <Link href="/privacy" className="text-orange-400 hover:underline">
              Privacy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="text-orange-400 hover:underline">
              Terms
            </Link>
            . Product background:{" "}
            <Link href="/about" className="text-orange-400 hover:underline">
              About
            </Link>
            .
          </p>
        </section>
      </main>
    </MarketingPageShell>
  );
}
