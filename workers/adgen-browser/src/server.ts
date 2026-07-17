/**
 * AdGen Browser Worker HTTP API
 *
 * Endpoints:
 *   GET  /health
 *   POST /scrape   { url, screenshot?, timeoutMs? }
 *
 * Auth: Authorization: Bearer <ADGEN_BROWSER_SECRET>
 * Env:  PORT (default 8787), ADGEN_BROWSER_SECRET (optional if unset = open)
 */

import http from "node:http";
import { scrapeInspiration } from "./scrape.js";
import type { ScrapeRequest } from "./types.js";

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.ADGEN_BROWSER_SECRET || "";

function json(res: http.ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function authorized(req: http.IncomingMessage): boolean {
  if (!SECRET) return true;
  const h = req.headers.authorization || "";
  return h === `Bearer ${SECRET}`;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      service: "adgen-browser-worker",
      version: "0.1.0",
      playwright: true,
    });
  }

  if (req.method === "POST" && url.pathname === "/scrape") {
    if (!authorized(req)) {
      return json(res, 401, { error: "Unauthorized" });
    }
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}") as ScrapeRequest;
      if (!body.url || typeof body.url !== "string") {
        return json(res, 400, { error: "url is required" });
      }
      try {
        new URL(body.url);
      } catch {
        return json(res, 400, { error: "invalid url" });
      }
      if (!/^https?:$/i.test(new URL(body.url).protocol)) {
        return json(res, 400, { error: "only http(s) urls" });
      }

      console.log(`[scrape] ${body.url}`);
      const result = await scrapeInspiration({
        url: body.url,
        screenshot: Boolean(body.screenshot),
        timeoutMs: body.timeoutMs,
      });
      console.log(`[scrape] ok title="${result.title.slice(0, 40)}"`);
      return json(res, 200, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "scrape failed";
      console.error("[scrape] error", message);
      return json(res, 500, { error: message });
    }
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`AdGen Browser Worker listening on :${PORT}`);
  console.log(`  GET  /health`);
  console.log(`  POST /scrape`);
  if (SECRET) console.log(`  Auth: Bearer token required`);
  else console.log(`  Auth: open (set ADGEN_BROWSER_SECRET in production)`);
});
