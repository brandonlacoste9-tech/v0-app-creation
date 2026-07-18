import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/for-cursor", label: "Cursor" },
  { href: "/byob", label: "BYOB" },
  { href: "/pricing", label: "Pricing" },
  { href: "/gallery", label: "Showcase" },
] as const;

export function MarketingPageShell({
  children,
  maxWidth = "max-w-3xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div
          className={`mx-auto flex h-14 ${maxWidth} items-center justify-between px-4`}
        >
          <Link
            href="/"
            className="text-sm font-bold uppercase tracking-tighter"
          >
            Shipboard
            <span className="ml-1.5 rounded-md border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-orange-400">
              Beta
            </span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground sm:gap-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/studio"
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400"
            >
              Studio
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-border px-4 py-10">
        <div
          className={`mx-auto flex ${maxWidth} flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between`}
        >
          <p>Shipboard · public beta · AI compiler for developers</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/vs/v0" className="hover:text-foreground">
              vs v0
            </Link>
            <Link href="/vs/lovable" className="hover:text-foreground">
              vs Lovable
            </Link>
            <Link href="/ai-ui-builder" className="hover:text-foreground">
              AI UI builder
            </Link>
            <Link href="/generate-nextjs" className="hover:text-foreground">
              Next.js generator
            </Link>
            <Link href="/llms.txt" className="hover:text-foreground">
              llms.txt
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function MarketingCta({
  primary = "Open studio",
  primaryHref = "/studio",
  secondary = "Read docs",
  secondaryHref = "/docs",
}: {
  primary?: string;
  primaryHref?: string;
  secondary?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href={primaryHref}
        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400"
      >
        {primary}
        <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        href={secondaryHref}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:border-orange-500/40"
      >
        {secondary}
      </Link>
    </div>
  );
}
