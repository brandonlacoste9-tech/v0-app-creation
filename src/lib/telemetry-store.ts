/**
 * Agent X-Ray telemetry store: ring buffer + tenant-scoped Neon persistence.
 */
import { neon } from "@neondatabase/serverless";
import { ensureTenantAuthTables } from "./tenant-auth";

export type TelemetryEventRecord = {
  id: string;
  type: "tool_start" | "tool_success" | "tool_error" | "run_finish" | string;
  tool: string;
  args?: unknown;
  resultPreview?: unknown;
  error?: string;
  latencyMs?: number;
  runId?: string;
  timestamp: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  model?: string;
  meta?: Record<string, unknown>;
  receivedAt: string;
  tenantId?: string;
  projectId?: string;
};

const MAX = 500;
const events: TelemetryEventRecord[] = [];

function id(): string {
  return `tel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    return neon(url);
  } catch {
    return null;
  }
}

export async function appendTelemetryEvent(
  partial: Omit<TelemetryEventRecord, "id" | "receivedAt"> & { id?: string }
): Promise<TelemetryEventRecord> {
  // Require tenant for durable multi-tenant writes
  const rec: TelemetryEventRecord = {
    id: partial.id || id(),
    type: partial.type,
    tool: partial.tool,
    args: partial.args,
    resultPreview: partial.resultPreview,
    error: partial.error,
    latencyMs: partial.latencyMs,
    runId: partial.runId,
    timestamp: partial.timestamp || new Date().toISOString(),
    promptTokens: partial.promptTokens,
    completionTokens: partial.completionTokens,
    totalTokens: partial.totalTokens,
    estimatedCostUsd: partial.estimatedCostUsd,
    model: partial.model,
    meta: partial.meta,
    receivedAt: new Date().toISOString(),
    tenantId: partial.tenantId,
    projectId: partial.projectId,
  };

  // Memory: only keep events for same process; still store for local dev
  events.unshift(rec);
  if (events.length > MAX) events.length = MAX;

  if (!rec.tenantId) {
    // Refuse unscoped durable write
    return rec;
  }

  try {
    await ensureTenantAuthTables();
    const sql = getSql();
    if (sql) {
      await sql`
        INSERT INTO shipboard_telemetry (
          id, type, tool, args, result_preview, error, latency_ms, run_id,
          timestamp, prompt_tokens, completion_tokens, total_tokens,
          estimated_cost_usd, model, meta, received_at, tenant_id, project_id
        ) VALUES (
          ${rec.id},
          ${rec.type},
          ${rec.tool},
          ${JSON.stringify(rec.args ?? null)},
          ${JSON.stringify(rec.resultPreview ?? null)},
          ${rec.error ?? null},
          ${rec.latencyMs ?? null},
          ${rec.runId ?? null},
          ${rec.timestamp},
          ${rec.promptTokens ?? null},
          ${rec.completionTokens ?? null},
          ${rec.totalTokens ?? null},
          ${rec.estimatedCostUsd ?? null},
          ${rec.model ?? null},
          ${JSON.stringify(rec.meta ?? null)},
          ${rec.receivedAt},
          ${rec.tenantId},
          ${rec.projectId ?? null}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  } catch (e) {
    console.warn("[telemetry] persist failed", e);
  }

  return rec;
}

export async function listTelemetryEvents(opts?: {
  limit?: number;
  runId?: string;
  tool?: string;
  type?: string;
  /** Required for multi-tenant list */
  tenantId?: string;
  projectId?: string;
}): Promise<TelemetryEventRecord[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), MAX);
  const tenantId = opts?.tenantId;

  if (tenantId) {
    try {
      await ensureTenantAuthTables();
      const sql = getSql();
      if (sql) {
        const rows = await sql`
          SELECT
            id, type, tool, args, result_preview, error, latency_ms, run_id,
            timestamp, prompt_tokens, completion_tokens, total_tokens,
            estimated_cost_usd, model, meta, received_at, tenant_id, project_id
          FROM shipboard_telemetry
          WHERE tenant_id = ${tenantId}
          ORDER BY received_at DESC
          LIMIT ${Math.min(limit * 3, 500)}
        `;
        if (Array.isArray(rows) && rows.length) {
          let mapped = rows.map(rowToRec);
          if (opts?.projectId) {
            mapped = mapped.filter((e) => e.projectId === opts.projectId);
          }
          if (opts?.runId) mapped = mapped.filter((e) => e.runId === opts.runId);
          if (opts?.tool) mapped = mapped.filter((e) => e.tool === opts.tool);
          if (opts?.type) mapped = mapped.filter((e) => e.type === opts.type);
          return mapped.slice(0, limit);
        }
      }
    } catch {
      /* memory */
    }
  }

  let list = events;
  if (tenantId) list = list.filter((e) => e.tenantId === tenantId);
  if (opts?.projectId) list = list.filter((e) => e.projectId === opts.projectId);
  if (opts?.runId) list = list.filter((e) => e.runId === opts.runId);
  if (opts?.tool) list = list.filter((e) => e.tool === opts.tool);
  if (opts?.type) list = list.filter((e) => e.type === opts.type);
  return list.slice(0, limit);
}

function rowToRec(r: Record<string, unknown>): TelemetryEventRecord {
  return {
    id: String(r.id),
    type: String(r.type),
    tool: String(r.tool),
    args: r.args,
    resultPreview: r.result_preview,
    error: r.error != null ? String(r.error) : undefined,
    latencyMs: r.latency_ms != null ? Number(r.latency_ms) : undefined,
    runId: r.run_id != null ? String(r.run_id) : undefined,
    timestamp: String(r.timestamp),
    promptTokens: r.prompt_tokens != null ? Number(r.prompt_tokens) : undefined,
    completionTokens:
      r.completion_tokens != null ? Number(r.completion_tokens) : undefined,
    totalTokens: r.total_tokens != null ? Number(r.total_tokens) : undefined,
    estimatedCostUsd:
      r.estimated_cost_usd != null ? Number(r.estimated_cost_usd) : undefined,
    model: r.model != null ? String(r.model) : undefined,
    meta: (r.meta as Record<string, unknown>) || undefined,
    receivedAt: String(r.received_at),
    tenantId: r.tenant_id != null ? String(r.tenant_id) : undefined,
    projectId: r.project_id != null ? String(r.project_id) : undefined,
  };
}

export async function clearTelemetryEvents(tenantId?: string): Promise<void> {
  if (tenantId) {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].tenantId === tenantId) events.splice(i, 1);
    }
  } else {
    events.length = 0;
  }
  try {
    await ensureTenantAuthTables();
    const sql = getSql();
    if (sql && tenantId) {
      await sql`DELETE FROM shipboard_telemetry WHERE tenant_id = ${tenantId}`;
    }
  } catch {
    /* ignore */
  }
}

export function telemetryStats(list?: TelemetryEventRecord[]): {
  total: number;
  errors: number;
  byTool: Record<string, number>;
  totalTokens: number;
  totalCostUsd: number;
  runs: number;
} {
  const source = list ?? events;
  const byTool: Record<string, number> = {};
  let errors = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let runs = 0;
  for (const e of source) {
    byTool[e.tool] = (byTool[e.tool] || 0) + 1;
    if (e.type === "tool_error") errors++;
    if (e.type === "run_finish") {
      runs++;
      totalTokens += e.totalTokens ?? 0;
      totalCostUsd += e.estimatedCostUsd ?? 0;
    }
  }
  return {
    total: source.length,
    errors,
    byTool,
    totalTokens,
    totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
    runs,
  };
}
