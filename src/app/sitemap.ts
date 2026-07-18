import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/** Public marketing + product surfaces for Google / Bing / AI crawlers. */
const PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/studio", changeFrequency: "weekly", priority: 0.9 },
  { path: "/gallery", changeFrequency: "daily", priority: 0.85 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.85 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.85 },
  { path: "/for-cursor", changeFrequency: "weekly", priority: 0.8 },
  { path: "/byob", changeFrequency: "weekly", priority: 0.8 },
  { path: "/ai-ui-builder", changeFrequency: "weekly", priority: 0.85 },
  { path: "/generate-nextjs", changeFrequency: "weekly", priority: 0.85 },
  { path: "/vs/v0", changeFrequency: "monthly", priority: 0.8 },
  { path: "/vs/lovable", changeFrequency: "monthly", priority: 0.75 },
  { path: "/llms.txt", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  return PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
