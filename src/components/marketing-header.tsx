"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { ShipboardLogo } from "@/components/shipboard-logo";
import { cn } from "@/lib/utils";

export const MARKETING_NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/for-cursor", label: "Cursor" },
  { href: "/byob", label: "BYOB" },
  { href: "/pricing", label: "Pricing" },
  { href: "/gallery", label: "Showcase" },
] as const;

export type MarketingNavItem = { href: string; label: string };

export function MarketingHeader({
  maxWidth = "max-w-3xl",
  extra = [],
}: {
  maxWidth?: string;
  extra?: MarketingNavItem[];
}) {
  const [open, setOpen] = useState(false);
  const links = [...extra, ...MARKETING_NAV];

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div
        className={cn(
          "mx-auto flex h-14 items-center justify-between px-4",
          maxWidth
        )}
      >
        <Link href="/" className="flex items-center gap-1.5">
          <ShipboardLogo size="sm" priority />
          <span className="hidden text-sm font-bold uppercase tracking-tighter min-[380px]:inline">
            Shipboard
          </span>
          <span className="ml-1 rounded-md border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-orange-400">
            Beta
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
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
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
            aria-expanded={open}
            aria-controls="marketing-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="marketing-mobile-nav"
          className="border-t border-border bg-background px-4 py-3 lg:hidden"
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-1">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/privacy"
              className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              Terms
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function MarketingFooter({
  maxWidth = "max-w-3xl",
}: {
  maxWidth?: string;
}) {
  return (
    <footer className="border-t border-border px-4 py-10">
      <div
        className={cn(
          "mx-auto flex flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between",
          maxWidth
        )}
      >
        <p>Shipboard · public beta · AI compiler for developers</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
          <Link href="/changelog" className="hover:text-foreground">
            Changelog
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
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
  );
}
