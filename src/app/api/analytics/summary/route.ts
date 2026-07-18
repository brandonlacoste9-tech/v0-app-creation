import { NextResponse } from "next/server";
import { getTrafficSummary } from "@/lib/visitor-analytics";

export const runtime = "nodejs";

function isAuthorized(req: Request): boolean {
  const expected =
    process.env.MIGRATE_SECRET?.trim() ||
    process.env.ADMIN_SECRET?.trim() ||
    "";
  if (!expected) {
    // Dev convenience only
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() === expected;
  }
  const url = new URL(req.url);
  return url.searchParams.get("secret") === expected;
}

/**
 * Traffic summary for beta ops.
 * Auth: Authorization: Bearer MIGRATE_SECRET (or ADMIN_SECRET)
 * GET /api/analytics/summary?days=14
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") || "14");
  const summary = await getTrafficSummary(days);
  return NextResponse.json(summary);
}
