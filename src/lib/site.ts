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

/**
 * Published Max-plan support channel.
 * Mailbox existence was not independently verified in the 2026-09-21 pass —
 * GitHub issues remain a guaranteed-working fallback.
 */
export const SUPPORT_EMAIL = "hello@shipboard.ca";
export const SUPPORT_ISSUES_URL =
  "https://github.com/brandonlacoste9-tech/v0-app-creation/issues";

/**
 * Google Search Console HTML meta verification token (public by design).
 * Override with GOOGLE_SITE_VERIFICATION if you rotate the property.
 */
export const GOOGLE_SITE_VERIFICATION =
  process.env.GOOGLE_SITE_VERIFICATION?.trim() ||
  "h9AWOSjaEgCGNAGX2VKoEQwR8uLcZsjrFw3lkwUm0uk";

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
  "ship AI UI to Netlify",
];
