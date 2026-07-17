"use client";

/**
 * Shipboard DevTools — studio-only (logs + actions + DB explorer).
 * Never ejected into shipped apps.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  isDevtoolsPush,
  requestDevtoolsDb,
  type DevtoolsEntry,
} from "@/lib/devtools/protocol";
import { emitPreviewMetric } from "@/lib/preview-metrics";
import {
  Terminal,
  Zap,
  Trash2,
  ChevronDown,
  ChevronUp,
  Database,
  RefreshCw,
} from "lucide-react";

type Tab = "db" | "actions" | "logs";

const MAX = 200;

type TableInfo = { name: string; rowCount: number; columns: string[] };

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
  iframeRef,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>("db");
  const [entries, setEntries] = useState<DevtoolsEntry[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [table, setTable] = useState<string>("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [dbError, setDbError] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [editJson, setEditJson] = useState("");
  const openedOnce = useRef(false);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (!isDevtoolsPush(ev.data)) return;
      setEntries((prev) => {
        const next = [ev.data.entry, ...prev];
        if (next.length > MAX) next.length = MAX;
        return next;
      });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (open && !openedOnce.current) {
      openedOnce.current = true;
      emitPreviewMetric("preview_prepare", { source: "devtools_opened" });
    }
  }, [open]);

  const refreshTables = useCallback(async () => {
    setDbLoading(true);
    setDbError("");
    try {
      const data = (await requestDevtoolsDb(iframeRef?.current ?? null, "db_list_tables")) as {
        tables: TableInfo[];
        note?: string;
      };
      setTables(data.tables || []);
      if (data.note === "no_preview_db") {
        setDbError("No mock DB in this preview (generate a UI that uses @/app/actions).");
      }
      if (data.tables?.length && !table) {
        setTable(data.tables[0].name);
      }
    } catch (e) {
      setDbError(e instanceof Error ? e.message : String(e));
      setTables([]);
    } finally {
      setDbLoading(false);
    }
  }, [iframeRef, table]);

  const refreshRows = useCallback(async () => {
    if (!table) {
      setRows([]);
      return;
    }
    setDbLoading(true);
    setDbError("");
    try {
      const data = (await requestDevtoolsDb(iframeRef?.current ?? null, "db_get_rows", {
        table,
        search: search || undefined,
        limit: 80,
      })) as {
        rows: Record<string, unknown>[];
        columns: string[];
        total: number;
      };
      setRows(data.rows || []);
      setColumns(data.columns || []);
    } catch (e) {
      setDbError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setDbLoading(false);
    }
  }, [iframeRef, table, search]);

  useEffect(() => {
    if (open && tab === "db") {
      void refreshTables();
    }
  }, [open, tab, refreshTables]);

  useEffect(() => {
    if (open && tab === "db" && table) {
      void refreshRows();
    }
  }, [open, tab, table, search, refreshRows]);

  const clear = useCallback(() => setEntries([]), []);

  const saveRow = async () => {
    if (!table || !editJson.trim()) return;
    try {
      const row = JSON.parse(editJson) as Record<string, unknown>;
      await requestDevtoolsDb(iframeRef?.current ?? null, "db_upsert", {
        table,
        row,
        idKey: "id",
      });
      setSelected(null);
      setEditJson("");
      await refreshRows();
      await refreshTables();
    } catch (e) {
      setDbError(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteRow = async (row: Record<string, unknown>) => {
    if (!table || row.id == null) return;
    try {
      await requestDevtoolsDb(iframeRef?.current ?? null, "db_delete", {
        table,
        idKey: "id",
        idValue: row.id as string | number,
      });
      setSelected(null);
      await refreshRows();
      await refreshTables();
    } catch (e) {
      setDbError(e instanceof Error ? e.message : String(e));
    }
  };

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
              {(
                [
                  { id: "db" as const, icon: Database, label: "Data" },
                  { id: "actions" as const, icon: Zap, label: "Actions" },
                  { id: "logs" as const, icon: Terminal, label: "Logs" },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 font-medium",
                    tab === id
                      ? "bg-zinc-800 text-orange-300"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  {id === "actions" && actions.length > 0 && (
                    <span className="text-zinc-500">{actions.length}</span>
                  )}
                  {id === "logs" && logs.length > 0 && (
                    <span className="text-zinc-500">{logs.length}</span>
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (tab === "db") {
                  void refreshTables().then(() => refreshRows());
                } else {
                  clear();
                }
              }}
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              title={tab === "db" ? "Refresh tables" : "Clear log"}
            >
              {tab === "db" ? (
                <RefreshCw className="h-3 w-3" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              {tab === "db" ? "Refresh" : "Clear"}
            </button>
          </>
        )}
      </div>

      {open && tab === "db" && (
        <div className="flex max-h-56 min-h-[140px] flex-col overflow-hidden text-[10px]">
          {dbError && (
            <p className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-amber-200/90">
              {dbError}
            </p>
          )}
          <div className="flex min-h-0 flex-1">
            <aside className="w-28 shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-950/80">
              {dbLoading && tables.length === 0 && (
                <p className="p-2 text-zinc-600">Loading…</p>
              )}
              {tables.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setTable(t.name);
                    setSelected(null);
                  }}
                  className={cn(
                    "flex w-full flex-col border-b border-zinc-900 px-2 py-1.5 text-left hover:bg-zinc-900",
                    table === t.name && "bg-zinc-900 text-orange-300"
                  )}
                >
                  <span className="truncate font-mono font-semibold">{t.name}</span>
                  <span className="text-zinc-600">{t.rowCount} rows</span>
                </button>
              ))}
              {!dbLoading && tables.length === 0 && !dbError && (
                <p className="p-2 text-zinc-600">No tables</p>
              )}
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-2 py-1">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter rows…"
                  className="h-6 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 font-mono text-[10px] text-zinc-300 outline-none focus:border-orange-500/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelected({});
                    setEditJson("{\n  \n}");
                  }}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-orange-500/40 hover:text-orange-300"
                >
                  + Row
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {rows.length === 0 ? (
                  <p className="p-3 text-zinc-600">
                    {table ? "No rows" : "Select a table"}
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left font-mono">
                    <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                      <tr>
                        {columns.slice(0, 6).map((c) => (
                          <th key={c} className="px-2 py-1 font-medium">
                            {c}
                          </th>
                        ))}
                        <th className="px-2 py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-t border-zinc-900 hover:bg-zinc-900/80"
                        >
                          {columns.slice(0, 6).map((c) => (
                            <td
                              key={c}
                              className="max-w-[100px] truncate px-2 py-1 text-zinc-400"
                            >
                              {safePreview(row[c], 40)}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-2 py-1">
                            <button
                              type="button"
                              className="text-orange-400/80 hover:text-orange-300"
                              onClick={() => {
                                setSelected(row);
                                setEditJson(JSON.stringify(row, null, 2));
                              }}
                            >
                              Edit
                            </button>
                            {row.id != null && (
                              <button
                                type="button"
                                className="ml-2 text-zinc-600 hover:text-red-400"
                                onClick={() => void deleteRow(row)}
                              >
                                Del
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            {selected && (
              <div className="flex w-44 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
                <div className="border-b border-zinc-800 px-2 py-1 font-semibold text-zinc-400">
                  Row JSON
                </div>
                <textarea
                  value={editJson}
                  onChange={(e) => setEditJson(e.target.value)}
                  className="min-h-0 flex-1 resize-none bg-transparent p-2 font-mono text-[9px] text-emerald-500/80 outline-none"
                />
                <div className="flex gap-1 border-t border-zinc-800 p-1">
                  <button
                    type="button"
                    onClick={() => void saveRow()}
                    className="flex-1 rounded bg-orange-500 py-1 text-[10px] font-bold text-black"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setEditJson("");
                    }}
                    className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {open && tab === "actions" && (
        <div className="max-h-44 overflow-auto font-mono text-[10px] leading-relaxed">
          {actions.length === 0 && (
            <p className="px-3 py-4 text-zinc-600">
              Server Action calls from the preview appear here. Interact with
              the UI (or edit data) to populate.
            </p>
          )}
          {actions.map((e, i) => {
            if (e.kind !== "action") return null;
            return (
              <div
                key={`${e.ts}-${e.name}-${i}`}
                className="border-b border-zinc-900 px-3 py-1.5 hover:bg-zinc-900/80"
              >
                <div className="flex items-center gap-2">
                  <span className={e.ok ? "text-emerald-400" : "text-red-400"}>
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
        </div>
      )}

      {open && tab === "logs" && (
        <div className="max-h-44 overflow-auto font-mono text-[10px] leading-relaxed">
          {logs.length === 0 && (
            <p className="px-3 py-4 text-zinc-600">
              console.log / warn / error and runtime errors from the iframe.
            </p>
          )}
          {logs.map((e, i) => {
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
                <span className="mr-2 text-zinc-600">{e.ts.slice(11, 19)}</span>
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
