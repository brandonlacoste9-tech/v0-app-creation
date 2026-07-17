import { chromium, type Page } from "playwright";
import type { InspirationScrape, ScrapeRequest } from "./types.js";

const CTA_RE =
  /start free|get started|sign up|try free|book demo|buy now|subscribe|learn more|view docs|contact|request access|join|download/i;

function uniq(items: string[], max = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t || t.length > 80) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function buildBrief(s: Omit<InspirationScrape, "briefPrompt" | "source" | "scrapedAt">): string {
  const lines = [
    `INSPIRATION FROM ${s.url}`,
    s.title ? `Product/page title: ${s.title}` : null,
    s.description ? `Meta description: ${s.description}` : null,
    s.headings.length ? `Headlines: ${s.headings.slice(0, 6).join(" · ")}` : null,
    s.ctaTexts.length ? `CTAs: ${s.ctaTexts.slice(0, 6).join(" · ")}` : null,
    s.navLabels.length ? `Nav: ${s.navLabels.slice(0, 8).join(", ")}` : null,
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

async function extractFromPage(page: Page, url: string): Promise<{
  title: string;
  description: string;
  headings: string[];
  ctaTexts: string[];
  navLabels: string[];
  colors: string[];
  fonts: string[];
  designNotes: string[];
}> {
  return page.evaluate((pageUrl) => {
    const text = (el: Element | null) =>
      (el?.textContent || "").replace(/\s+/g, " ").trim();

    const title = document.title || text(document.querySelector("h1")) || "";
    const description =
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") ||
      document
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content") ||
      "";

    const headings = [...document.querySelectorAll("h1, h2")]
      .map((h) => text(h))
      .filter(Boolean)
      .slice(0, 12);

    const ctaCandidates = [
      ...document.querySelectorAll(
        'a, button, [role="button"], input[type="submit"]'
      ),
    ]
      .map((el) => text(el))
      .filter((t) => t.length >= 2 && t.length <= 48);

    const ctaTexts = ctaCandidates.filter((t) =>
      /start free|get started|sign up|try free|book demo|buy now|subscribe|learn more|view docs|contact|request access|join|download|pricing|demo/i.test(
        t
      )
    );

    const navLabels = [
      ...document.querySelectorAll("nav a, header a"),
    ]
      .map((a) => text(a))
      .filter((t) => t.length >= 2 && t.length <= 32)
      .slice(0, 16);

    const colors = new Set<string>();
    const theme =
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content") || "";
    if (theme) colors.add(theme);

    const sample = [
      document.body,
      ...document.querySelectorAll("header, nav, main, a, button"),
    ].slice(0, 40);

    for (const el of sample) {
      if (!(el instanceof HTMLElement)) continue;
      const cs = getComputedStyle(el);
      for (const prop of ["backgroundColor", "color", "borderColor"] as const) {
        const v = cs[prop];
        if (!v || v === "transparent" || v === "rgba(0, 0, 0, 0)") continue;
        // rgb/rgba → keep as-is for brief (model can map to Tailwind)
        if (v.startsWith("rgb")) colors.add(v);
      }
    }

    const fonts = new Set<string>();
    const bodyFont = getComputedStyle(document.body).fontFamily;
    if (bodyFont) fonts.add(bodyFont.split(",")[0]?.replace(/["']/g, "").trim());

    const designNotes: string[] = [];
    const hasHero = !!document.querySelector("h1");
    const hasNav = !!document.querySelector("nav, header");
    const btnCount = document.querySelectorAll("button, a.button, [class*='btn']")
      .length;
    const dark =
      getComputedStyle(document.body).backgroundColor.includes("rgb(0") ||
      getComputedStyle(document.body).backgroundColor.includes("rgb(9") ||
      getComputedStyle(document.documentElement).colorScheme === "dark";

    if (hasHero) designNotes.push("Strong H1 / hero hierarchy present");
    if (hasNav) designNotes.push("Header/nav structure present");
    if (btnCount > 3) designNotes.push("Multiple interactive CTAs");
    designNotes.push(dark ? "Dark-leaning palette" : "Light-leaning palette");
    designNotes.push(`Source host: ${new URL(pageUrl).hostname}`);

    const sectionCount = document.querySelectorAll("section, [class*='section']")
      .length;
    if (sectionCount >= 3) {
      designNotes.push(`Multi-section landing (~${sectionCount} sections)`);
    }

    return {
      title,
      description,
      headings,
      ctaTexts,
      navLabels,
      colors: [...colors].slice(0, 12),
      fonts: [...fonts].slice(0, 4),
      designNotes,
    };
  }, url);
}

function assertPublicHttpUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs allowed");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host) ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Private / local URLs are blocked");
  }
}

export async function scrapeInspiration(
  req: ScrapeRequest
): Promise<InspirationScrape> {
  const url = req.url.trim();
  assertPublicHttpUrl(url);
  const timeout = Math.min(Math.max(req.timeoutMs ?? 25000, 5000), 60000);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (compatible; AdGenBrowser/0.1; +https://adgenai.ca)",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    // Let late CSS / hero paint
    await page.waitForTimeout(1200);

    const extracted = await extractFromPage(page, url);
    let screenshotDataUrl: string | undefined;
    if (req.screenshot) {
      const buf = await page.screenshot({ type: "png", fullPage: false });
      screenshotDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    }

    const base = {
      url,
      title: extracted.title,
      description: extracted.description,
      headings: uniq(extracted.headings, 10),
      ctaTexts: uniq(extracted.ctaTexts.length ? extracted.ctaTexts : extracted.headings, 8),
      navLabels: uniq(extracted.navLabels, 12),
      colors: extracted.colors,
      fonts: extracted.fonts,
      designNotes: extracted.designNotes,
      screenshotDataUrl,
    };

    // Filter CTAs with shared regex intent if evaluate missed
    if (!base.ctaTexts.length) {
      base.ctaTexts = uniq(
        extracted.headings.filter((h) => CTA_RE.test(h)),
        6
      );
    }

    const scrapedAt = new Date().toISOString();
    return {
      ...base,
      briefPrompt: buildBrief(base),
      scrapedAt,
      source: "worker",
    };
  } finally {
    await browser.close();
  }
}
