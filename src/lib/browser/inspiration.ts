/**
 * Inspiration scrape result — design brief fuel for AdGen generations.
 * Produced by the Playwright worker (or stub when worker is offline).
 */

export interface InspirationScrape {
  url: string;
  title: string;
  description: string;
  headings: string[];
  ctaTexts: string[];
  navLabels: string[];
  /** Hex colors sampled from page (theme-color, CSS vars, button/bg guesses) */
  colors: string[];
  fonts: string[];
  /** Short human notes for the model */
  designNotes: string[];
  /** Ready-to-paste design brief fragment for chat */
  briefPrompt: string;
  screenshotDataUrl?: string;
  scrapedAt: string;
  source: "worker" | "stub";
}

export function buildInspirationBrief(s: InspirationScrape): string {
  const lines = [
    `INSPIRATION FROM ${s.url}`,
    s.title ? `Product/page title: ${s.title}` : null,
    s.description ? `Meta description: ${s.description}` : null,
    s.headings.length
      ? `Headlines: ${s.headings.slice(0, 6).join(" · ")}`
      : null,
    s.ctaTexts.length
      ? `CTAs: ${s.ctaTexts.slice(0, 6).join(" · ")}`
      : null,
    s.navLabels.length
      ? `Nav: ${s.navLabels.slice(0, 8).join(", ")}`
      : null,
    s.colors.length ? `Palette hints: ${s.colors.slice(0, 8).join(", ")}` : null,
    s.fonts.length ? `Fonts: ${s.fonts.slice(0, 4).join(", ")}` : null,
    s.designNotes.length
      ? `Notes:\n${s.designNotes.map((n) => `- ${n}`).join("\n")}`
      : null,
    "",
    "Build a production React + Tailwind UI inspired by this (not a pixel clone).",
    "Match the product intent, hierarchy, and CTA language; invent missing sections.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
