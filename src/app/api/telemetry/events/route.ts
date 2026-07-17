import { NextResponse } from "next/server";
import {
  appendTelemetryEvent,
  clearTelemetryEvents,
  listTelemetryEvents,
  telemetryStats,
} from "@/lib/telemetry-store";

export const runtime = "nodejs";

/**
 * Phase D — Agent X-Ray collector.
 * Ejected apps POST here via SHIPBOARD_TELEMETRY_URL.
 * Optional: Authorization: Bearer <SHIPBOARD_TELEMETRY_INGEST_TOKEN>
 */
function authorize(req: Request): boolean {
  const expected = process.env.SHIPBOARD_TELEMETRY_INGEST_TOKEN?.trim();
  if (!expected) return true; // open ingest when unset (dev)
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Batch or single
  const batch = Array.isArray(body.events) ? body.events : [body];
  const saved = [];
  for (const raw of batch) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.tool !== "string" || typeof e.type !== "string") continue;
    saved.push(
      appendTelemetryEvent({
        type: e.type as string,
        tool: e.tool as string,
        args: e.args,
        resultPreview: e.resultPreview,
        error: typeof e.error === "string" ? e.error : undefined,
        latencyMs: typeof e.latencyMs === "number" ? e.latencyMs : undefined,
        runId: typeof e.runId === "string" ? e.runId : undefined,
        timestamp:
          typeof e.timestamp === "string"
            ? e.timestamp
            : new Date().toISOString(),
        meta:
          e.meta && typeof e.meta === "object"
            ? (e.meta as Record<string, unknown>)
            : undefined,
      })
    );
  }

  return NextResponse.json({ ok: true, count: saved.length });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const runId = url.searchParams.get("runId") || undefined;
  const tool = url.searchParams.get("tool") || undefined;
  const type = url.searchParams.get("type") || undefined;

  return NextResponse.json({
    events: listTelemetryEvents({ limit, runId, tool, type }),
    stats: telemetryStats(),
  });
}

export async function DELETE() {
  clearTelemetryEvents();
  return NextResponse.json({ ok: true });
}
