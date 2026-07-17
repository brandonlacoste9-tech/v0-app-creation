"use client";

/**
 * Shipboard DevTools — studio-only panel (logs + Server Actions inspector).
 * Never ejected into shipped apps.
 */
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  isDevtoolsMessage,
  type DevtoolsEntry,
} from "@/lib/devtools/protocol";
import { Terminal, Zap, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type Tab = "logs" | "actions";

const MAX = 200;

function safePreview(v: unknown, max = 180): string {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (!s) return "—";
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    return String(v);
  }
}

export function PreviewDevtools({
  open,
  onToggle,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>("actions");
  const [entries, setEntries] = useState<DevtoolsEntry[]>([]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (!isDevtoolsMessage(ev.data)) return;
      setEntries((prev) => {
        const next = [ev.data.entry, ...prev];
        if (next.length > MAX) next.length = MAX;
        return next;
      });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Clear when panel closed then reopened? Keep history across toggle.
  const clear = useCallback(() => setEntries([]), []);

  const logs = entries.filter(
    (e) => e.kind === "console" || e.kind === "runtime"
  );
  const actions = entries.filter((e) => e.kind === "action");

  return (
    <div
      className={cn(
        "flex flex-col border-t border-border bg-zinc-950 text-zinc-200",
        className
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-zinc-800 px-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-orange-400 hover:text-orange-300"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
          DevTools
        </button>
        {open && (
          <>
            <div className="flex rounded-md border border-zinc-800 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setTab("actions")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium",
                  tab === "actions"
                    ? "bg-zinc-800 text-orange-300"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Zap className="h-3 w-3" />
                Actions
                {actions.length > 0 && (
                  <span className="text-zinc-500">{actions.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("logs")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium",
                  tab === "logs"
                    ? "bg-zinc-800 text-orange-300"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Terminal className="h-3 w-3" />
                Logs
                {logs.length > 0 && (
                  <span className="text-zinc-500">{logs.length}</span>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={clear}
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              title="Clear"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="max-h-44 overflow-auto font-mono text-[10px] leading-relaxed">
          {tab === "actions" && actions.length === 0 && (
            <p className="px-3 py-4 text-zinc-600">
              Server Action calls from the preview appear here (listUsers,
              createUser, …). Interact with the UI to populate.
            </p>
          )}
          {tab === "logs" && logs.length === 0 && (
            <p className="px-3 py-4 text-zinc-600">
              console.log / warn / error and runtime errors from the iframe.
            </p>
          )}
          {tab === "actions" &&
            actions.map((e, i) => {
              if (e.kind !== "action") return null;
              return (
                <div
                  key={`${e.ts}-${e.name}-${i}`}
                  className="border-b border-zinc-900 px-3 py-1.5 hover:bg-zinc-900/80"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        e.ok ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {e.ok ? "✓" : "✗"}
                    </span>
                    <span className="font-semibold text-orange-300/90">
                      {e.name}
                    </span>
                    <span className="text-zinc-600">{e.ms}ms</span>
                    <span className="ml-auto text-zinc-600">
                      {e.ts.slice(11, 19)}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-zinc-500">
                    args: {safePreview(e.args)}
                  </div>
                  {e.ok ? (
                    <div className="truncate text-zinc-500">
                      → {safePreview(e.result)}
                    </div>
                  ) : (
                    <div className="truncate text-red-400/90">{e.error}</div>
                  )}
                </div>
              );
            })}
          {tab === "logs" &&
            logs.map((e, i) => {
              const level =
                e.kind === "console"
                  ? e.level
                  : e.kind === "runtime"
                    ? "error"
                    : "log";
              const msg =
                e.kind === "console"
                  ? e.message
                  : e.kind === "runtime"
                    ? e.message
                    : "";
              const color =
                level === "error"
                  ? "text-red-400"
                  : level === "warn"
                    ? "text-amber-400"
                    : "text-zinc-400";
              return (
                <div
                  key={`${e.ts}-${i}`}
                  className="border-b border-zinc-900 px-3 py-1 hover:bg-zinc-900/80"
                >
                  <span className="mr-2 text-zinc-600">
                    {e.ts.slice(11, 19)}
                  </span>
                  <span className={cn("mr-2 uppercase", color)}>{level}</span>
                  <span className={color}>{msg}</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
