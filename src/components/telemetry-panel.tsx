"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, DollarSign, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TelEvent = {
  id: string;
  type: string;
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
};

interface TelemetryPanelProps {
  open: boolean;
  onClose: () => void;
}

function formatUsd(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

export function TelemetryPanel({ open, onClose }: TelemetryPanelProps) {
  const [events, setEvents] = useState<TelEvent[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    errors: number;
    byTool: Record<string, number>;
    totalTokens?: number;
    totalCostUsd?: number;
    runs?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TelEvent | null>(null);
  const [economic, setEconomic] = useState<{
    tokens?: number;
    tokensLimit?: number | null;
    estimatedCostUsd?: number;
    costLimitUsd?: number | null;
    telemetryEvents?: number;
    telemetryLimit?: number | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, usageRes] = await Promise.all([
        fetch("/api/telemetry/events?limit=100"),
        fetch("/api/usage"),
      ]);
      const data = await res.json();
      setEvents(data.events || []);
      setStats(data.stats || null);
      if (usageRes.ok) {
        const u = await usageRes.json();
        // /api/usage returns flat UsageSnapshot fields
        setEconomic({
          tokens: u.tokens,
          tokensLimit: u.quotas?.tokensPerDay ?? null,
          estimatedCostUsd: u.estimated_cost_usd,
          costLimitUsd: u.quotas?.estimatedCostUsdPerDay ?? null,
          telemetryEvents: u.telemetry_events,
          telemetryLimit: u.quotas?.telemetryEventsPerDay ?? null,
        });
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [open, load]);

  if (!open) return null;

  const runEvents = events.filter((e) => e.type === "run_finish");

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-semibold">Agent X-Ray</span>
          {stats && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {stats.total} events · {stats.errors} err
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => void load()}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={async () => {
              await fetch("/api/telemetry/events", { method: "DELETE" });
              void load();
              setSelected(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Token cost + budget panel */}
      <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <div className="rounded-lg border border-border bg-background px-2 py-1.5">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            Est. cost / day
          </div>
          <div className="font-mono text-sm font-semibold text-emerald-400">
            {formatUsd(economic?.estimatedCostUsd ?? stats?.totalCostUsd)}
            {economic?.costLimitUsd != null && (
              <span className="text-[10px] font-normal text-muted-foreground">
                {" "}
                / {formatUsd(economic.costLimitUsd)}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Tokens / day
          </div>
          <div className="font-mono text-sm font-semibold text-foreground">
            {(economic?.tokens ?? stats?.totalTokens)?.toLocaleString() ?? "—"}
            {economic?.tokensLimit != null && (
              <span className="text-[10px] font-normal text-muted-foreground">
                {" "}
                / {economic.tokensLimit.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Runs · telem
          </div>
          <div className="font-mono text-sm font-semibold text-foreground">
            {stats?.runs ?? runEvents.length}
            {economic?.telemetryLimit != null && (
              <span className="text-[10px] font-normal text-muted-foreground">
                {" "}
                · {economic.telemetryEvents ?? 0}/{economic.telemetryLimit}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground leading-relaxed">
        Tool traces + <code className="text-foreground/80">run_finish</code> usage
        from ejected apps. Cost uses configurable $/1M rates (defaults ≈ 4o-mini).
      </p>

      <div className="flex min-h-0 flex-1">
        <ul className="w-[45%] overflow-y-auto border-r border-border">
          {events.length === 0 && (
            <li className="p-4 text-xs text-muted-foreground">No events yet.</li>
          )}
          {events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelected(e)}
                className={cn(
                  "w-full border-b border-border/60 px-3 py-2 text-left text-[11px] hover:bg-accent/50",
                  selected?.id === e.id && "bg-accent"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "font-mono font-medium",
                      e.type === "tool_error" && "text-red-400",
                      e.type === "tool_success" && "text-emerald-400",
                      e.type === "tool_start" && "text-sky-400",
                      e.type === "run_finish" && "text-amber-400"
                    )}
                  >
                    {e.type.replace("tool_", "").replace("run_", "run:")}
                  </span>
                  {e.type === "run_finish" ? (
                    <span className="font-mono text-emerald-400/90">
                      {formatUsd(e.estimatedCostUsd)}
                    </span>
                  ) : e.latencyMs != null ? (
                    <span className="font-mono text-muted-foreground">
                      {e.latencyMs}ms
                    </span>
                  ) : null}
                </div>
                <div className="truncate font-mono text-foreground/90">{e.tool}</div>
                {e.type === "run_finish" && e.totalTokens != null && (
                  <div className="truncate text-muted-foreground">
                    {e.totalTokens} tok
                    {e.model ? ` · ${e.model}` : ""}
                  </div>
                )}
                {e.error && (
                  <div className="truncate text-red-400/90">{e.error}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="w-[55%] overflow-y-auto p-3">
          {!selected && (
            <p className="text-xs text-muted-foreground">
              Select an event for payload / cost detail.
            </p>
          )}
          {selected && (
            <div className="space-y-2 text-[10px] font-mono">
              <div>
                <span className="text-muted-foreground">tool </span>
                {selected.tool}
              </div>
              <div>
                <span className="text-muted-foreground">run </span>
                {selected.runId || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">time </span>
                {selected.timestamp}
              </div>
              {(selected.totalTokens != null ||
                selected.estimatedCostUsd != null) && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 space-y-0.5">
                  <div>
                    tokens in/out/total: {selected.promptTokens ?? "—"} /{" "}
                    {selected.completionTokens ?? "—"} /{" "}
                    {selected.totalTokens ?? "—"}
                  </div>
                  <div className="text-emerald-400">
                    est. cost: {formatUsd(selected.estimatedCostUsd)}
                  </div>
                  {selected.model && <div>model: {selected.model}</div>}
                </div>
              )}
              {selected.error && (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-red-300">
                  {selected.error}
                </div>
              )}
              <div>
                <div className="mb-1 text-muted-foreground">args</div>
                <pre className="max-h-40 overflow-auto rounded border border-border bg-muted/40 p-2 whitespace-pre-wrap break-all">
                  {JSON.stringify(selected.args, null, 2)}
                </pre>
              </div>
              {selected.resultPreview != null && (
                <div>
                  <div className="mb-1 text-muted-foreground">result</div>
                  <pre className="max-h-40 overflow-auto rounded border border-border bg-muted/40 p-2 whitespace-pre-wrap break-all">
                    {JSON.stringify(selected.resultPreview, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
