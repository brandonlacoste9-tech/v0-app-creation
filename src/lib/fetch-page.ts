/**
 * Server-side public-page extract for studio rebuilds.
 * No headless browser — HTML only. Block private hosts.
 */

export type PageFacts = {
  url: string;
  title: string;
  description: string;
  headings: string[];
  emails: string[];
  phones: string[];
  hoursLines: string[];
  ctas: string[];
  textPreview: string;
  ogImage?: string;
  fetchedAt: string;
};

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|0\.|192\.168\.|169\.254\.|::1|\[::1\])/i;
const PRIVATE_172 = /^172\.(1[6-9]|2\d|3[0-1])\./;

export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs can be scraped");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    PRIVATE_HOST.test(host) ||
    PRIVATE_172.test(host)
  ) {
    throw new Error("That host is not a public website");
  }
  return u;
}

export function extractUrlsFromText(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  const out: string[] = [];
  for (const raw of found) {
    const cleaned = raw.replace(/[),.;]+$/, "");
    try {
      assertPublicHttpUrl(cleaned);
      if (!out.includes(cleaned)) out.push(cleaned);
    } catch {
      /* skip */
    }
    if (out.length >= 2) break;
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    "i"
  );
  return decodeEntities((html.match(re)?.[1] || html.match(re2)?.[1] || "").trim());
}

function allMatches(html: string, re: RegExp): string[] {
  const out: string[] = [];
  const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = copy.exec(html))) {
    const v = decodeEntities(m[1] || "").trim();
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= 16) break;
  }
  return out;
}

function visibleText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped).slice(0, 5000);
}

export function parsePageHtml(url: string, html: string): PageFacts {
  const title =
    decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") ||
    new URL(url).hostname;
  const description =
    meta(html, "description") || meta(html, "og:description");
  const ogImage = meta(html, "og:image") || undefined;
  const headings = [
    ...allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    ...allMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i),
  ].map((h) => h.replace(/<[^>]+>/g, "").trim()).filter(Boolean);

  const text = visibleText(html);
  const emails = [
    ...allMatches(html, /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i),
    ...(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []),
  ]
    .map((e) => e.toLowerCase())
    .filter((e, i, a) => a.indexOf(e) === i)
    .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg"))
    .slice(0, 8);

  const telHrefs = allMatches(html, /href=["']tel:([^"']+)["']/i);
  const phoneLike =
    text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g)?.map((p) => p.trim()) || [];
  const phones = [...telHrefs, ...phoneLike]
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p, i, a) => a.indexOf(p) === i)
    .slice(0, 8);

  const hoursLines = text
    .split(/(?<=[.!?])\s+/)
    .filter((line) =>
      /\b(hours?|open|mon|tue|wed|thu|fri|sat|sun|monday|friday|weekend)\b/i.test(
        line
      ) && /\d/.test(line)
    )
    .slice(0, 8);

  const ctas = allMatches(
    html,
    /<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/i
  )
    .map((t) => t.replace(/<[^>]+>/g, "").trim())
    .filter((t) => t.length > 1 && t.length < 48)
    .slice(0, 10);

  return {
    url,
    title,
    description,
    headings: headings.slice(0, 12),
    emails,
    phones,
    hoursLines,
    ctas,
    textPreview: text.slice(0, 2500),
    ogImage,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchPublicPage(rawUrl: string): Promise<PageFacts> {
  const u = assertPublicHttpUrl(rawUrl);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ShipboardStudio/0.2 (+https://shipboard.ca)",
      },
    });
    if (!res.ok) {
      throw new Error(`Fetch failed (${res.status}) for ${u.hostname}`);
    }
    const ctype = res.headers.get("content-type") || "";
    if (ctype && !/html|xml|text\//i.test(ctype)) {
      throw new Error(`Not an HTML page (${ctype})`);
    }
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > 1_000_000 ? buf.slice(0, 1_000_000) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    return parsePageHtml(u.toString(), html);
  } finally {
    clearTimeout(timer);
  }
}

export function factsToPromptBlock(f: PageFacts): string {
  const lines = [
    `LIVE SITE FACTS (printed on the page — do not invent extras)`,
    `URL: ${f.url}`,
    `Title: ${f.title}`,
    f.description ? `Description: ${f.description}` : null,
    f.headings.length ? `Headings: ${f.headings.join(" · ")}` : null,
    f.emails.length
      ? `Emails found: ${f.emails.join(", ")}`
      : `Emails found: none printed`,
    f.phones.length
      ? `Phones found: ${f.phones.join(", ")}`
      : `Phones found: none printed`,
    f.hoursLines.length ? `Hours-like lines: ${f.hoursLines.join(" | ")}` : null,
    f.ctas.length ? `CTA labels: ${f.ctas.join(" · ")}` : null,
    f.ogImage ? `og:image: ${f.ogImage}` : null,
    "",
    "HONESTY: only use contact, hours, prices, names, and testimonials if they appear above or in the text preview. If missing, omit — do not invent. tel: and mailto: only unless the source clearly has a booking product.",
    "",
    `Text preview:\n${f.textPreview}`,
  ];
  return lines.filter((x) => x !== null).join("\n");
}
