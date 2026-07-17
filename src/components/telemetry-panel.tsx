"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, RefreshCw, Trash2, X } from "lucide-react";
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
};

interface TelemetryPanelProps {
  open: boolean;
  onClose: () => void;
}

export function TelemetryPanel({ open, onClose }: TelemetryPanelProps) {
  const [events, setEvents] = useState<TelEvent[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    errors: number;
    byTool: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TelEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telemetry/events?limit=80");
      const data = await res.json();
      setEvents(data.events || []);
      setStats(data.stats || null);
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

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
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

      <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground leading-relaxed">
        Live tool traces from ejected apps posting to{" "}
        <code className="text-foreground/80">/api/telemetry/events</code>. Set{" "}
        <code className="text-foreground/80">SHIPBOARD_TELEMETRY_URL</code> in the clone.
      </p>

      <div className="flex min-h-0 flex-1">
        <ul className="w-1/2 overflow-y-auto border-r border-border">
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
                      e.type === "tool_start" && "text-sky-400"
                    )}
                  >
                    {e.type.replace("tool_", "")}
                  </span>
                  {e.latencyMs != null && (
                    <span className="font-mono text-muted-foreground">{e.latencyMs}ms</span>
                  )}
                </div>
                <div className="truncate font-mono text-foreground/90">{e.tool}</div>
                {e.error && (
                  <div className="truncate text-red-400/90">{e.error}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="w-1/2 overflow-y-auto p-3">
          {!selected && (
            <p className="text-xs text-muted-foreground">Select an event for payload.</p>
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
