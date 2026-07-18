import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/**
 * Allow major search + AI crawlers on marketing content.
 * Disallow APIs and internal tools.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/internal/"],
      },
      // Explicit allow for common AI crawlers (same public surface)
      {
        userAgent: "GPTBot",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "anthropic-ai",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "Applebot-Extended",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "Amazonbot",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "cohere-ai",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "meta-externalagent",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
      {
        userAgent: "Bytespider",
        allow: ["/", "/docs", "/for-cursor", "/gallery", "/llms.txt"],
        disallow: ["/api/", "/internal/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base.replace(/^https?:\/\//, ""),
  };
}
