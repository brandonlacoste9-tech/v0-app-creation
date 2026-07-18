import { NextResponse } from "next/server";
import { recordPageview } from "@/lib/visitor-analytics";

export const runtime = "nodejs";

/**
 * First-party pageview beacon (no third-party).
 * POST { path, referrer?, visitorId? }
 */
export async function POST(req: Request) {
  let body: {
    path?: string;
    referrer?: string;
    visitorId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent");
  const result = await recordPageview({
    path: body.path || "/",
    referrer: body.referrer,
    visitorId: body.visitorId,
    userAgent: ua,
  });

  // Always 204-ish success to avoid client noise; bots filtered server-side
  return NextResponse.json({ ok: result.ok }, { status: 200 });
}
