/**
 * First-party visitor analytics (no third-party cookies).
 * Stores pageviews in Postgres when DATABASE_URL is set; otherwise in-memory.
 */
import { neon } from "@neondatabase/serverless";

export interface PageviewInput {
  path: string;
  referrer?: string | null;
  visitorId?: string | null;
  userAgent?: string | null;
}

export interface PathStat {
  path: string;
  views: number;
  visitors: number;
}

export interface DayStat {
  day: string;
  views: number;
  visitors: number;
}

export interface TrafficSummary {
  rangeDays: number;
  totalViews: number;
  totalVisitors: number;
  byPath: PathStat[];
  byDay: DayStat[];
  source: "postgres" | "memory";
}

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return neon(url);
}

/** Normalize and allowlist paths we care about for beta funnel. */
export function normalizeAnalyticsPath(raw: string): string | null {
  try {
    let p = raw.split("?")[0].split("#")[0].trim() || "/";
    if (!p.startsWith("/")) p = `/${p}`;
    // strip trailing slash except root
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    // collapse /studio/foo → /studio
    if (p.startsWith("/studio")) return "/studio";
    if (p.startsWith("/gallery")) return p === "/gallery" ? "/gallery" : "/gallery/[id]";
    if (p.startsWith("/share")) return "/share";
    if (p.startsWith("/docs")) return "/docs";
    if (p.startsWith("/for-cursor")) return "/for-cursor";
    if (p.startsWith("/byob")) return "/byob";
    if (p.startsWith("/ai-ui-builder")) return "/ai-ui-builder";
    if (p.startsWith("/generate-nextjs")) return "/generate-nextjs";
    if (p.startsWith("/vs/")) return p.startsWith("/vs/v0") ? "/vs/v0" : p.startsWith("/vs/lovable") ? "/vs/lovable" : "/vs";
    if (p === "/" || p === "/pricing") return p;
    return null;
  } catch {
    return null;
  }
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|wget|curl|python-requests/i.test(
    ua
  );
}

let tablesReady = false;
async function ensureTrafficTables(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  if (tablesReady) return true;
  await sql`
    CREATE TABLE IF NOT EXISTS shipboard_pageviews (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      referrer TEXT DEFAULT '',
      visitor_id TEXT DEFAULT '',
      day TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_pageviews_day_path
    ON shipboard_pageviews (day, path)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_pageviews_visitor_day
    ON shipboard_pageviews (day, visitor_id)
  `;
  tablesReady = true;
  return true;
}

// ─── memory fallback ─────────────────────────────────────────
type MemRow = {
  id: string;
  path: string;
  referrer: string;
  visitorId: string;
  day: string;
  createdAt: string;
};
const mem: MemRow[] = [];
const MEM_MAX = 5000;

export async function recordPageview(input: PageviewInput): Promise<{ ok: boolean }> {
  const path = normalizeAnalyticsPath(input.path || "/");
  if (!path) return { ok: false };
  if (isBotUserAgent(input.userAgent)) return { ok: false };

  const day = new Date().toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  const referrer = (input.referrer || "").slice(0, 500);
  const visitorId = (input.visitorId || "").slice(0, 64);

  const sqlReady = await ensureTrafficTables();
  const sql = getSql();
  if (sqlReady && sql) {
    await sql`
      INSERT INTO shipboard_pageviews (id, path, referrer, visitor_id, day, created_at)
      VALUES (${id}, ${path}, ${referrer}, ${visitorId}, ${day}, ${new Date().toISOString()})
    `;
    return { ok: true };
  }

  mem.unshift({
    id,
    path,
    referrer,
    visitorId,
    day,
    createdAt: new Date().toISOString(),
  });
  if (mem.length > MEM_MAX) mem.length = MEM_MAX;
  return { ok: true };
}

export async function getTrafficSummary(rangeDays = 14): Promise<TrafficSummary> {
  const days = Math.min(Math.max(rangeDays, 1), 90);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const sinceDay = since.toISOString().slice(0, 10);

  const sqlReady = await ensureTrafficTables();
  const sql = getSql();

  if (sqlReady && sql) {
    const totals = await sql`
      SELECT
        COUNT(*)::int AS views,
        COUNT(DISTINCT NULLIF(visitor_id, ''))::int AS visitors
      FROM shipboard_pageviews
      WHERE day >= ${sinceDay}
    `;
    const byPath = await sql`
      SELECT
        path,
        COUNT(*)::int AS views,
        COUNT(DISTINCT NULLIF(visitor_id, ''))::int AS visitors
      FROM shipboard_pageviews
      WHERE day >= ${sinceDay}
      GROUP BY path
      ORDER BY views DESC
      LIMIT 30
    `;
    const byDay = await sql`
      SELECT
        day,
        COUNT(*)::int AS views,
        COUNT(DISTINCT NULLIF(visitor_id, ''))::int AS visitors
      FROM shipboard_pageviews
      WHERE day >= ${sinceDay}
      GROUP BY day
      ORDER BY day ASC
    `;
    return {
      rangeDays: days,
      totalViews: Number(totals[0]?.views ?? 0),
      totalVisitors: Number(totals[0]?.visitors ?? 0),
      byPath: byPath.map((r) => ({
        path: String(r.path),
        views: Number(r.views),
        visitors: Number(r.visitors),
      })),
      byDay: byDay.map((r) => ({
        day: String(r.day),
        views: Number(r.views),
        visitors: Number(r.visitors),
      })),
      source: "postgres",
    };
  }

  const rows = mem.filter((r) => r.day >= sinceDay);
  const pathMap = new Map<string, { views: number; vids: Set<string> }>();
  const dayMap = new Map<string, { views: number; vids: Set<string> }>();
  const allVids = new Set<string>();
  for (const r of rows) {
    if (r.visitorId) allVids.add(r.visitorId);
    const p = pathMap.get(r.path) || { views: 0, vids: new Set() };
    p.views++;
    if (r.visitorId) p.vids.add(r.visitorId);
    pathMap.set(r.path, p);
    const d = dayMap.get(r.day) || { views: 0, vids: new Set() };
    d.views++;
    if (r.visitorId) d.vids.add(r.visitorId);
    dayMap.set(r.day, d);
  }
  return {
    rangeDays: days,
    totalViews: rows.length,
    totalVisitors: allVids.size,
    byPath: [...pathMap.entries()]
      .map(([path, v]) => ({
        path,
        views: v.views,
        visitors: v.vids.size,
      }))
      .sort((a, b) => b.views - a.views),
    byDay: [...dayMap.entries()]
      .map(([day, v]) => ({
        day,
        views: v.views,
        visitors: v.vids.size,
      }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    source: "memory",
  };
}
