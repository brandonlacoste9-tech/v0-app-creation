"use client";

/**
 * Dogfood dashboard — preview projection quality metrics (no PII).
 * Open /internal/preview-metrics while using the studio.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  clearPreviewMetrics,
  getPreviewMetrics,
  summarizePreviewMetrics,
  type PreviewMetricsSummary,
} from "@/lib/preview-metrics";

function pct(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export default function PreviewMetricsPage() {
  const [summary, setSummary] = useState<PreviewMetricsSummary | null>(null);

  const refresh = useCallback(() => {
    setSummary(summarizePreviewMetrics(getPreviewMetrics(400)));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!summary) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-400">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              Dogfood
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Preview metrics
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Hybrid single-pass projection health: mount success, truncation,
              BYOB schema usage. Stored in this browser only (localStorage). No
              PII.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/studio"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500"
            >
              Studio
            </Link>
            <button
              type="button"
              onClick={() => {
                clearPreviewMetrics();
                refresh();
              }}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-red-500/50 hover:text-red-300"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Mount success rate"
            value={pct(summary.mountSuccessRate)}
            hint={`${summary.mountSuccess} ok / ${summary.mountFallback} fallback`}
          />
          <Stat
            label="Truncation events"
            value={String(summary.truncation)}
            hint={`Continue: ${summary.continueClicks} · done: ${summary.continueCompleted}`}
          />
          <Stat
            label="BYOB schema used"
            value={String(summary.byobSchema)}
            hint={`prepare: ${summary.prepare}`}
          />
          <Stat
            label="Schema vs none (mounts)"
            value={`${summary.schemaVsNone.schema} / ${summary.schemaVsNone.none}`}
            hint="schema · no-schema"
          />
        </div>

        {Object.keys(summary.fallbackReasons).length > 0 && (
          <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-semibold text-zinc-200">
              Fallback reasons
            </h2>
            <ul className="mt-3 space-y-1 font-mono text-xs text-zinc-400">
              {Object.entries(summary.fallbackReasons)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, n]) => (
                  <li key={reason} className="flex justify-between gap-4">
                    <span className="truncate">{reason}</span>
                    <span className="text-zinc-200">{n}</span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-zinc-200">
            Recent events ({summary.recent.length})
          </h2>
          <div className="mt-3 max-h-[420px] overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Time</th>
                  <th className="py-1.5 pr-3 font-medium">Type</th>
                  <th className="py-1.5 font-medium">Props</th>
                </tr>
              </thead>
              <tbody className="font-mono text-zinc-400">
                {summary.recent.map((e) => (
                  <tr key={e.id} className="border-t border-zinc-800/80">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-zinc-500">
                      {e.ts.slice(11, 19)}
                    </td>
                    <td className="py-1.5 pr-3 text-orange-300/90">{e.type}</td>
                    <td className="py-1.5 max-w-md truncate">
                      {JSON.stringify(e.props)}
                    </td>
                  </tr>
                ))}
                {summary.recent.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-zinc-600">
                      No events yet — open Studio, generate a preview, then
                      refresh.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-8 text-xs text-zinc-600">
          Disable:{" "}
          <code className="text-zinc-500">
            localStorage.shipboard_preview_metrics = &quot;0&quot;
          </code>{" "}
          or{" "}
          <code className="text-zinc-500">NEXT_PUBLIC_PREVIEW_METRICS=0</code>
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}
