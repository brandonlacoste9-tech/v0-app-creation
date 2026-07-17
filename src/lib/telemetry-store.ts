/**
 * In-process ring buffer for Agent X-Ray / studio telemetry events.
 * Phase D — not a multi-region warehouse; good for live debugging.
 */

export type TelemetryEventRecord = {
  id: string;
  type: "tool_start" | "tool_success" | "tool_error" | string;
  tool: string;
  args?: unknown;
  resultPreview?: unknown;
  error?: string;
  latencyMs?: number;
  runId?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  receivedAt: string;
};

const MAX = 500;
const events: TelemetryEventRecord[] = [];

function id(): string {
  return `tel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function appendTelemetryEvent(
  partial: Omit<TelemetryEventRecord, "id" | "receivedAt"> & { id?: string }
): TelemetryEventRecord {
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
    meta: partial.meta,
    receivedAt: new Date().toISOString(),
  };
  events.unshift(rec);
  if (events.length > MAX) events.length = MAX;
  return rec;
}

export function listTelemetryEvents(opts?: {
  limit?: number;
  runId?: string;
  tool?: string;
  type?: string;
}): TelemetryEventRecord[] {
  let list = events;
  if (opts?.runId) list = list.filter((e) => e.runId === opts.runId);
  if (opts?.tool) list = list.filter((e) => e.tool === opts.tool);
  if (opts?.type) list = list.filter((e) => e.type === opts.type);
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), MAX);
  return list.slice(0, limit);
}

export function clearTelemetryEvents(): void {
  events.length = 0;
}

export function telemetryStats(): {
  total: number;
  errors: number;
  byTool: Record<string, number>;
} {
  const byTool: Record<string, number> = {};
  let errors = 0;
  for (const e of events) {
    byTool[e.tool] = (byTool[e.tool] || 0) + 1;
    if (e.type === "tool_error") errors++;
  }
  return { total: events.length, errors, byTool };
}
