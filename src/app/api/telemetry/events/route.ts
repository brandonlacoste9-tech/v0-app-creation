import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import {
  appendTelemetryEvent,
  clearTelemetryEvents,
  listTelemetryEvents,
  telemetryStats,
} from "@/lib/telemetry-store";
import {
  extractBearer,
  resolveIngestKey,
  resolvePat,
} from "@/lib/tenant-auth";
import { checkAndConsume } from "@/lib/economic-limits";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Multi-tenant Agent X-Ray ingest + read.
 *
 * Ingest (ejected app): Authorization: Bearer sb_ing_… + body.projectId optional
 * Dashboard read: signed-in user cookie (tenant-scoped list)
 */
export async function POST(req: Request) {
  const bearer = extractBearer(req);
  if (!bearer?.startsWith("sb_ing_")) {
    return NextResponse.json(
      {
        error:
          "Ingest requires Authorization: Bearer <SHIPBOARD_INGEST_KEY> (sb_ing_…)",
      },
      { status: 401 }
    );
  }

  const auth = await resolveIngestKey(bearer);
  if (!auth?.tenantId || !auth.projectId) {
    return NextResponse.json(
      { error: "Invalid or revoked ingest key" },
      { status: 401 }
    );
  }

  const user = await storage.getUserById(auth.tenantId);
  const plan = user?.plan ?? "free";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Optional body.projectId must match key's project
  if (
    typeof body.projectId === "string" &&
    body.projectId &&
    body.projectId !== auth.projectId
  ) {
    return NextResponse.json(
      { error: "projectId does not match ingest key" },
      { status: 403 }
    );
  }

  const batch = Array.isArray(body.events) ? body.events : [body];
  const eventCount = batch.filter(
    (raw) =>
      raw &&
      typeof raw === "object" &&
      typeof (raw as { tool?: unknown }).tool === "string" &&
      typeof (raw as { type?: unknown }).type === "string"
  ).length;

  const limit = await checkAndConsume(
    auth.tenantId,
    plan,
    "telemetry_events",
    Math.max(eventCount, 1)
  );
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: limit.error,
        code: limit.code,
        upgrade: limit.upgrade,
        usage: limit.usage,
      },
      {
        status: 429,
        headers: limit.retryAfterSec
          ? { "Retry-After": String(limit.retryAfterSec) }
          : undefined,
      }
    );
  }

  const saved = [];
  for (const raw of batch) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.tool !== "string" || typeof e.type !== "string") continue;

    // Economic: token / cost budget on run_finish
    if (e.type === "run_finish") {
      const tokens =
        typeof e.totalTokens === "number"
          ? e.totalTokens
          : (typeof e.promptTokens === "number" ? e.promptTokens : 0) +
            (typeof e.completionTokens === "number" ? e.completionTokens : 0);
      if (tokens > 0) {
        const tok = await checkAndConsume(auth.tenantId, plan, "tokens", tokens);
        if (!tok.allowed) {
          return NextResponse.json(
            {
              error: tok.error,
              code: tok.code,
              upgrade: true,
              usage: tok.usage,
              partial: saved.length,
            },
            { status: 429 }
          );
        }
      }
      if (typeof e.estimatedCostUsd === "number" && e.estimatedCostUsd > 0) {
        const cost = await checkAndConsume(
          auth.tenantId,
          plan,
          "estimated_cost_usd",
          e.estimatedCostUsd
        );
        if (!cost.allowed) {
          return NextResponse.json(
            {
              error: cost.error,
              code: cost.code,
              upgrade: true,
              usage: cost.usage,
              partial: saved.length,
            },
            { status: 429 }
          );
        }
      }
    }

    saved.push(
      await appendTelemetryEvent({
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
        promptTokens:
          typeof e.promptTokens === "number" ? e.promptTokens : undefined,
        completionTokens:
          typeof e.completionTokens === "number"
            ? e.completionTokens
            : undefined,
        totalTokens:
          typeof e.totalTokens === "number" ? e.totalTokens : undefined,
        estimatedCostUsd:
          typeof e.estimatedCostUsd === "number"
            ? e.estimatedCostUsd
            : undefined,
        model: typeof e.model === "string" ? e.model : undefined,
        meta:
          e.meta && typeof e.meta === "object"
            ? (e.meta as Record<string, unknown>)
            : undefined,
        tenantId: auth.tenantId,
        projectId: auth.projectId,
      })
    );
  }

  return NextResponse.json({
    ok: true,
    count: saved.length,
    tenantId: auth.tenantId,
    projectId: auth.projectId,
    usage: limit.usage,
  });
}

/** Dashboard: list events for signed-in tenant only */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  // Also allow PAT for CLI inspection
  let tenantId = user?.id;
  if (!tenantId) {
    const bearer = extractBearer(req);
    if (bearer?.startsWith("sb_pat_")) {
      const auth = await resolvePat(bearer);
      tenantId = auth?.tenantId;
    }
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const runId = url.searchParams.get("runId") || undefined;
  const tool = url.searchParams.get("tool") || undefined;
  const type = url.searchParams.get("type") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;

  const events = await listTelemetryEvents({
    limit,
    runId,
    tool,
    type,
    tenantId,
    projectId,
  });
  return NextResponse.json({
    events,
    stats: telemetryStats(events),
    tenantId,
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  await clearTelemetryEvents(user.id);
  return NextResponse.json({ ok: true });
}
