import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession } from "@/lib/anon-session";
import { getPlanEntitlements, normalizePlan } from "@/lib/plans";
import {
  buildInspirationBrief,
  isValidHttpUrl,
  type InspirationScrape,
} from "@/lib/browser/inspiration";

/**
 * Proxy to AdGen Browser Worker (Playwright).
 * Env:
 *   ADGEN_BROWSER_WORKER_URL  e.g. http://127.0.0.1:8787
 *   ADGEN_BROWSER_SECRET      optional Bearer shared with worker
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const screenshot = Boolean(body?.screenshot);

    if (!url || !isValidHttpUrl(url)) {
      return NextResponse.json(
        { error: "Valid http(s) url is required" },
        { status: 400 }
      );
    }

    // Plan gate: browserAgent for open-web scrape
    const user = await getCurrentUser();
    let plan = "free";
    if (user) {
      const { storage } = await import("@/lib/storage");
      const u = await storage.getUserById(user.id);
      plan = normalizePlan(u?.plan);
    } else {
      const anon = await getAnonSession();
      plan = normalizePlan(anon.plan);
    }
    const ent = getPlanEntitlements(plan);
    if (!ent.browserAgent) {
      return NextResponse.json(
        {
          error: "Inspiration scrape is a Pro+ feature",
          upgrade: true,
          deferred: true,
        },
        { status: 403 }
      );
    }

    const workerUrl = process.env.ADGEN_BROWSER_WORKER_URL?.replace(/\/$/, "");
    if (!workerUrl) {
      // Stub brief so product flow still works in dev without worker
      const stub: InspirationScrape = {
        url,
        title: new URL(url).hostname,
        description: "",
        headings: [],
        ctaTexts: [],
        navLabels: [],
        colors: [],
        fonts: [],
        designNotes: [
          "Worker offline — set ADGEN_BROWSER_WORKER_URL to enable live scrape",
          `Target: ${url}`,
        ],
        briefPrompt: "",
        scrapedAt: new Date().toISOString(),
        source: "stub",
      };
      stub.briefPrompt = buildInspirationBrief(stub);
      return NextResponse.json({
        ok: false,
        deferred: true,
        scrape: stub,
        error:
          "Browser worker not configured. Run workers/adgen-browser and set ADGEN_BROWSER_WORKER_URL.",
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const secret = process.env.ADGEN_BROWSER_SECRET;
    if (secret) headers.Authorization = `Bearer ${secret}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(`${workerUrl}/scrape`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url, screenshot }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          {
            ok: false,
            error:
              (data as { error?: string }).error ||
              `Worker HTTP ${res.status}`,
          },
          { status: 502 }
        );
      }
      const scrape = data as InspirationScrape;
      if (!scrape.briefPrompt) {
        scrape.briefPrompt = buildInspirationBrief(scrape);
      }
      return NextResponse.json({ ok: true, scrape });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    const message =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Scrape timed out"
          : e.message
        : "Scrape failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
