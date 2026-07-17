/**
 * Agent X-Ray telemetry store: ring buffer + optional Neon persistence.
 */
import { neon } from "@neondatabase/serverless";

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

let tableReady: Promise<void> | null = null;

async function ensureTelemetryTable(): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS shipboard_telemetry (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          tool TEXT NOT NULL,
          args JSONB,
          result_preview JSONB,
          error TEXT,
          latency_ms INTEGER,
          run_id TEXT,
          timestamp TIMESTAMPTZ NOT NULL,
          prompt_tokens INTEGER,
          completion_tokens INTEGER,
          total_tokens INTEGER,
          estimated_cost_usd DOUBLE PRECISION,
          model TEXT,
          meta JSONB,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS shipboard_telemetry_run_id_idx
        ON shipboard_telemetry (run_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS shipboard_telemetry_received_at_idx
        ON shipboard_telemetry (received_at DESC)
      `;
    })().catch((e) => {
      tableReady = null;
      console.warn("[telemetry] table ensure failed", e);
    });
  }
  await tableReady;
}

export async function appendTelemetryEvent(
  partial: Omit<TelemetryEventRecord, "id" | "receivedAt"> & { id?: string }
): Promise<TelemetryEventRecord> {
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
  };
  events.unshift(rec);
  if (events.length > MAX) events.length = MAX;

  // Best-effort durable write
  try {
    const sql = getSql();
    if (sql) {
      await ensureTelemetryTable();
      await sql`
        INSERT INTO shipboard_telemetry (
          id, type, tool, args, result_preview, error, latency_ms, run_id,
          timestamp, prompt_tokens, completion_tokens, total_tokens,
          estimated_cost_usd, model, meta, received_at
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
          ${rec.receivedAt}
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
}): Promise<TelemetryEventRecord[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), MAX);

  // Prefer Neon when available (history across restarts)
  try {
    const sql = getSql();
    if (sql) {
      await ensureTelemetryTable();
      // Fetch recent, filter in process (simpler than dynamic SQL)
      const rows = await sql`
        SELECT
          id, type, tool, args, result_preview, error, latency_ms, run_id,
          timestamp, prompt_tokens, completion_tokens, total_tokens,
          estimated_cost_usd, model, meta, received_at
        FROM shipboard_telemetry
        ORDER BY received_at DESC
        LIMIT ${Math.min(limit * 3, 500)}
      `;
      if (Array.isArray(rows) && rows.length) {
        let mapped = rows.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          type: String(r.type),
          tool: String(r.tool),
          args: r.args,
          resultPreview: r.result_preview,
          error: r.error != null ? String(r.error) : undefined,
          latencyMs: r.latency_ms != null ? Number(r.latency_ms) : undefined,
          runId: r.run_id != null ? String(r.run_id) : undefined,
          timestamp: String(r.timestamp),
          promptTokens:
            r.prompt_tokens != null ? Number(r.prompt_tokens) : undefined,
          completionTokens:
            r.completion_tokens != null ? Number(r.completion_tokens) : undefined,
          totalTokens:
            r.total_tokens != null ? Number(r.total_tokens) : undefined,
          estimatedCostUsd:
            r.estimated_cost_usd != null
              ? Number(r.estimated_cost_usd)
              : undefined,
          model: r.model != null ? String(r.model) : undefined,
          meta: (r.meta as Record<string, unknown>) || undefined,
          receivedAt: String(r.received_at),
        }));
        if (opts?.runId) mapped = mapped.filter((e) => e.runId === opts.runId);
        if (opts?.tool) mapped = mapped.filter((e) => e.tool === opts.tool);
        if (opts?.type) mapped = mapped.filter((e) => e.type === opts.type);
        return mapped.slice(0, limit);
      }
    }
  } catch {
    /* fall back to memory */
  }

  let list = events;
  if (opts?.runId) list = list.filter((e) => e.runId === opts.runId);
  if (opts?.tool) list = list.filter((e) => e.tool === opts.tool);
  if (opts?.type) list = list.filter((e) => e.type === opts.type);
  return list.slice(0, limit);
}

export async function clearTelemetryEvents(): Promise<void> {
  events.length = 0;
  try {
    const sql = getSql();
    if (sql) {
      await ensureTelemetryTable();
      await sql`DELETE FROM shipboard_telemetry`;
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
