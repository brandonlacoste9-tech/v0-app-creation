import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing-header";

export function MarketingPageShell({
  children,
  maxWidth = "max-w-3xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader maxWidth={maxWidth} />
      {children}
      <MarketingFooter maxWidth={maxWidth} />
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
