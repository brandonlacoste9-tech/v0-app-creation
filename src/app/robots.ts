import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.shipboard.ca";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/gallery", "/studio", "/share"],
        disallow: ["/api/", "/internal/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
