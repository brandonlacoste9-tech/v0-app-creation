"use client";

import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CodeVersion } from "@/lib/types";

interface VersionTimelineProps {
  versions: CodeVersion[];
  activeVersionIndex: number;
  onVersionChange: (index: number) => void;
  /** Max chips before compacting to first/last + current window */
  maxVisibleChips?: number;
}

/** Compact list of version indices when there are many saves. */
function visibleIndices(count: number, active: number, max: number): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const set = new Set<number>();
  set.add(0);
  set.add(count - 1);
  set.add(active);
  for (let d = 1; set.size < max && d < count; d++) {
    if (active - d >= 0) set.add(active - d);
    if (set.size >= max) break;
    if (active + d < count) set.add(active + d);
  }
  return [...set].sort((a, b) => a - b);
}

export function VersionTimeline({
  versions,
  activeVersionIndex,
  onVersionChange,
  maxVisibleChips = 8,
}: VersionTimelineProps) {
  if (versions.length === 0) return null;

  const indices = visibleIndices(versions.length, activeVersionIndex, maxVisibleChips);
  const isLatest = activeVersionIndex === versions.length - 1;

  return (
    <div className="flex max-w-[min(92vw,560px)] items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 shadow-2xl backdrop-blur-md">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-white/10 pr-2.5">
        <History className="h-3.5 w-3.5 text-white/40" />
        <span className="hidden text-[10px] font-bold uppercase tracking-widest text-white/40 sm:inline">
          Versions
        </span>
      </div>

      <button
        type="button"
        onClick={() => onVersionChange(Math.max(0, activeVersionIndex - 1))}
        disabled={activeVersionIndex === 0}
        className="shrink-0 rounded-full p-1 text-white/60 transition-colors hover:bg-white/5 disabled:opacity-20"
        aria-label="Previous version"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-thin">
        {indices.map((idx, i) => {
          const gap = i > 0 && indices[i - 1] !== idx - 1;
          const active = idx === activeVersionIndex;
          const latest = idx === versions.length - 1;
          const title = versions[idx]?.title || versions[idx]?.prompt || `Version ${idx + 1}`;
          return (
            <div key={idx} className="flex shrink-0 items-center gap-1">
              {gap && (
                <span className="px-0.5 text-[10px] text-white/25" aria-hidden>
                  …
                </span>
              )}
              <button
                type="button"
                title={`${title}${latest ? " (latest)" : ""}`}
                onClick={() => onVersionChange(idx)}
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums transition-all",
                  active
                    ? "bg-emerald/25 text-emerald shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald/40"
                    : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/90"
                )}
              >
                v{idx + 1}
                {latest && !active ? (
                  <span className="ml-0.5 text-[8px] font-bold uppercase tracking-wide opacity-70">
                    ·
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() =>
          onVersionChange(Math.min(versions.length - 1, activeVersionIndex + 1))
        }
        disabled={activeVersionIndex === versions.length - 1}
        className="shrink-0 rounded-full p-1 text-white/60 transition-colors hover:bg-white/5 disabled:opacity-20"
        aria-label="Next version"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <div className="flex max-w-[120px] shrink-0 flex-col items-end border-l border-white/10 pl-2.5">
        <span className="font-mono text-[10px] leading-none text-white/90">
          v{activeVersionIndex + 1}
          <span className="text-white/35">/{versions.length}</span>
          {isLatest ? (
            <span className="ml-1 text-[8px] font-bold uppercase tracking-wide text-emerald/80">
              latest
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 line-clamp-1 text-right text-[9px] leading-none text-white/40">
          {versions[activeVersionIndex]?.title?.slice(0, 22) || "Checkpoint"}
        </span>
      </div>
    </div>
  );
}

/** Inline chip row for toolbars (preview header). */
export function VersionChips({
  versions,
  activeVersionIndex,
  onVersionChange,
  className,
}: {
  versions: CodeVersion[];
  activeVersionIndex: number;
  onVersionChange: (index: number) => void;
  className?: string;
}) {
  if (versions.length < 1) return null;
  const indices = visibleIndices(versions.length, activeVersionIndex, 7);
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {indices.map((idx, i) => {
        const gap = i > 0 && indices[i - 1] !== idx - 1;
        const active = idx === activeVersionIndex;
        const latest = idx === versions.length - 1;
        return (
          <div key={idx} className="flex items-center gap-1">
            {gap && <span className="text-[10px] text-muted-foreground/40">…</span>}
            <button
              type="button"
              title={
                versions[idx]?.title ||
                versions[idx]?.prompt ||
                `Version ${idx + 1}${latest ? " (latest)" : ""}`
              }
              onClick={() => onVersionChange(idx)}
              className={cn(
                "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums transition-all",
                active
                  ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40"
                  : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              v{idx + 1}
            </button>
          </div>
        );
      })}
    </div>
  );
}
