import { test, expect } from "@playwright/test";

/** Public marketing pages — no auth. Guards SEO deploy regressions. */
const SEO_PAGES: { path: string; title: RegExp; h1: RegExp }[] = [
  {
    path: "/",
    title: /Shipboard/i,
    h1: /./, // homepage may use marketing structure without single h1
  },
  {
    path: "/docs",
    title: /Docs|Documentation/i,
    h1: /Documentation/i,
  },
  {
    path: "/for-cursor",
    title: /Cursor/i,
    h1: /Cursor/i,
  },
  {
    path: "/pricing",
    title: /Pricing/i,
    h1: /pricing|plans|shipping/i,
  },
  {
    path: "/byob",
    title: /BYOB|Backend|Neon|Supabase/i,
    h1: /Postgres|Backend|schema/i,
  },
  {
    path: "/ai-ui-builder",
    title: /AI UI/i,
    h1: /AI UI|code you keep/i,
  },
  {
    path: "/generate-nextjs",
    title: /Next\.js/i,
    h1: /Next\.js/i,
  },
  {
    path: "/vs/v0",
    title: /v0/i,
    h1: /v0/i,
  },
  {
    path: "/vs/lovable",
    title: /Lovable/i,
    h1: /Lovable/i,
  },
  {
    path: "/gallery",
    title: /Showcase|Gallery|Shipboard/i,
    h1: /./,
  },
];

test.describe("SEO marketing pages", () => {
  for (const page of SEO_PAGES) {
    test(`${page.path} loads with title + indexable body`, async ({ page: p }) => {
      const res = await p.goto(page.path, { waitUntil: "domcontentloaded" });
      expect(res?.ok() || res?.status() === 304).toBeTruthy();

      await expect(p).toHaveTitle(page.title);

      // Canonical should be absolute shipboard URL for this path (root ok)
      const canonical = p.locator('link[rel="canonical"]');
      if ((await canonical.count()) > 0) {
        const href = await canonical.first().getAttribute("href");
        expect(href).toBeTruthy();
        if (page.path === "/") {
          expect(href).toMatch(/shipboard\.ca\/?$/i);
        } else {
          expect(href).toContain(page.path);
        }
      }

      // Body has meaningful text (not white-screen)
      const bodyText = await p.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(80);

      if (page.path !== "/" && page.path !== "/gallery") {
        await expect(p.locator("h1").first()).toBeVisible();
        await expect(p.locator("h1").first()).toHaveText(page.h1);
      }

      // CTA into product
      const studio = p.getByRole("link", { name: /studio|start free|get started|generate/i });
      await expect(studio.first()).toBeVisible();
    });
  }
});

test.describe("Crawl surfaces", () => {
  test("sitemap lists key SEO URLs", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
    const xml = await res.text();
    for (const path of [
      "/docs",
      "/pricing",
      "/ai-ui-builder",
      "/generate-nextjs",
      "/vs/v0",
      "/byob",
      "/llms.txt",
    ]) {
      expect(xml).toContain(path);
    }
  });

  test("robots.txt points at sitemap and allows crawl", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/Allow:\s*\//i);
    expect(text).toMatch(/Sitemap:\s*https?:\/\/.*sitemap\.xml/i);
    expect(text).toMatch(/Disallow:\s*\/api\//i);
  });

  test("llms.txt has product facts", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/Shipboard/i);
    expect(text).toMatch(/Cursor|Next\.js|BYOB/i);
    expect(text).toContain("/ai-ui-builder");
  });

  test("health endpoint is up", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
  });
});
