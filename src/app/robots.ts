import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "anthropic-ai",
  "ClaudeBot",
  "PerplexityBot",
  "Applebot-Extended",
  "Amazonbot",
  "cohere-ai",
  "meta-externalagent",
  "Bytespider",
] as const;

/**
 * Allow major search + AI crawlers on public content.
 * Disallow APIs and internal tools.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  const publicRule = {
    allow: "/",
    disallow: ["/api/", "/internal/"],
  };

  return {
    rules: [
      { userAgent: "*", ...publicRule },
      ...AI_BOTS.map((userAgent) => ({ userAgent, ...publicRule })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base.replace(/^https?:\/\//, ""),
  };
}
