/**
 * Canonical site URL for SEO, sitemap, robots, OG.
 * Prefer NEXT_PUBLIC_APP_URL (production: https://shipboard.ca).
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://shipboard.ca";
  return raw.replace(/\/$/, "");
}

export const SITE_NAME = "Shipboard";

export const DEFAULT_DESCRIPTION =
  "Shipboard is an AI compiler for developers. Chat an idea → production React + Tailwind + TypeScript, live preview, BYOB Postgres, one-click GitHub. Eject real Next.js — finish in Cursor.";

export const SEO_KEYWORDS = [
  "AI UI builder",
  "AI Next.js generator",
  "AI React generator",
  "v0 alternative",
  "Lovable alternative for developers",
  "Cursor AI workflow",
  "generate Next.js App Router",
  "AI Tailwind UI",
  "production dialect AI builder",
  "BYOB Drizzle Server Actions",
  "Shipboard",
  "AI app builder for developers",
  "eject AI generated code to GitHub",
  "AI code generator Next.js",
  "chat to React components",
  "ship AI UI to Vercel",
];
