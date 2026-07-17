"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  BUILD_STEPS,
  getBuildPhase,
  getVirtualFiles,
  phaseIndex,
  type StreamCodeState,
} from "@/lib/stream-code";
import type { PreviewTheme } from "@/lib/types";
import {
  Check,
  Circle,
  FileCode2,
  FolderOpen,
  Loader2,
  Sparkles,
  Terminal,
} from "lucide-react";

interface BuildViewProps {
  isGenerating: boolean;
  streamText: string;
  streamCode: StreamCodeState;
  theme: PreviewTheme;
  /** When true, fill available space (preview panel). */
  className?: string;
  byobSchema?: import("@/lib/byob/types").DatabaseSchemaMap | null;
}

const BUILD_LOG_LINES: Record<string, string[]> = {
  connecting: ["→ opening model channel…", "→ handshake ok"],
  planning: [
    "→ analyzing product intent…",
    "→ choosing layout system",
    "→ selecting design tokens",
  ],
  scaffolding: [
    "→ scaffolding App Router files…",
    "→ touch src/Component.tsx",
    "→ write package.json",
  ],
  writing: [
    "→ streaming UI sections…",
    "→ wiring state & handlers",
    "→ composing layout",
  ],
  styling: [
    "→ applying Tailwind utilities…",
    "→ responsive breakpoints",
    "→ spacing & contrast pass",
  ],
  mounting: [
    "→ packaging for preview…",
    "→ waiting for complete source",
  ],
  done: ["✓ build complete — opening preview"],
};

/**
 * Calm “building” surface (v0-style).
 * No live iframe while tokens stream — partial JSX remounts caused flicker/glitch.
 * Real preview mounts only after generation finishes (parent PreviewPanel).
 */
export function BuildView({
  isGenerating,
  streamText,
  streamCode,
  theme,
  className,
}: BuildViewProps) {
  const phase = getBuildPhase(isGenerating, streamCode, streamText.length > 0);
  const files = useMemo(
    () => getVirtualFiles(streamCode, phase),
    [streamCode, phase]
  );
  const currentIdx = phaseIndex(phase === "idle" ? "connecting" : phase);

  const codeScrollRef = useRef<HTMLPreElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

  useEffect(() => {
    if (codeScrollRef.current) {
      codeScrollRef.current.scrollTop = codeScrollRef.current.scrollHeight;
    }
  }, [streamCode.code, streamCode.entryCode, streamCode.charCount]);

  useEffect(() => {
    const base = BUILD_LOG_LINES[phase] ?? [];
    if (!isGenerating && phase !== "done") {
      setLogLines((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setLogLines((prev) => {
      const next = [...prev];
      let changed = false;
      for (const line of base) {
        if (!next.includes(line)) {
          next.push(line);
          changed = true;
        }
      }
      if (streamCode.lineCount > 0) {
        const progress = `→ Component.tsx · ${streamCode.lineCount} lines · ${streamCode.charCount} chars`;
        const filtered = next.filter((l) => !l.startsWith("→ Component.tsx"));
        filtered.push(progress);
        const sliced = filtered.slice(-18);
        if (
          sliced.length === prev.length &&
          sliced.every((l, i) => l === prev[i])
        ) {
          return prev;
        }
        return sliced;
      }
      if (!changed) return prev;
      return next.slice(-18);
    });
  }, [phase, isGenerating, streamCode.lineCount, streamCode.charCount]);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logLines]);

  const progressPct = Math.min(
    98,
    phase === "done"
      ? 100
      : Math.round(
          ((currentIdx + Math.min(1, streamCode.charCount / 2000)) /
            (BUILD_STEPS.length - 1)) *
            100
        )
  );

  const entryPreview =
    streamCode.entryCode ||
    (streamCode.files && Object.values(streamCode.files)[0]) ||
    streamCode.code ||
    "";

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      {/* Progress header */}
      <div className="shrink-0 border-b border-border bg-card/80 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/10">
              <Sparkles className="h-3.5 w-3.5 text-orange-400" />
              {isGenerating && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-orange-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {isGenerating ? "Building your project…" : "Build complete"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {BUILD_STEPS.find((s) => s.id === phase)?.detail ??
                  "Streaming sources — preview opens when the build finishes"}
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {progressPct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {BUILD_STEPS.map((step) => {
            const idx = phaseIndex(step.id);
            const done = currentIdx > idx || phase === "done";
            const active = currentIdx === idx && isGenerating;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  done && "border-emerald/30 bg-emerald/10 text-emerald",
                  active &&
                    "border-orange-500/40 bg-orange-500/10 text-orange-300",
                  !done && !active && "border-border text-muted-foreground/60"
                )}
              >
                {done ? (
                  <Check className="h-2.5 w-2.5" />
                ) : active ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Circle className="h-2 w-2" />
                )}
                {step.label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr]">
        {/* File tree + log */}
        <aside className="flex min-h-0 flex-col border-b border-border bg-[#0c0c0c] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <FolderOpen className="h-3 w-3" />
            Project
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2 font-mono text-[11px]">
            {files.map((f) => (
              <div
                key={f.path}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                  f.status === "writing" && "bg-orange-500/10 text-orange-200",
                  f.status === "done" && "text-emerald-300/90",
                  f.status === "pending" && "text-white/25"
                )}
              >
                <FileCode2 className="h-3 w-3 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{f.path}</span>
                {f.status === "writing" && (
                  <span className="shrink-0 text-[9px] text-orange-400">
                    {f.lines ? `${f.lines}L` : "…"}
                  </span>
                )}
                {f.status === "done" && (
                  <Check className="h-3 w-3 shrink-0 text-emerald" />
                )}
              </div>
            ))}
          </div>
          <div
            ref={logScrollRef}
            className="max-h-28 shrink-0 overflow-y-auto border-t border-white/5 bg-black/40 px-3 py-2 font-mono text-[9px] leading-relaxed text-white/45"
          >
            <div className="mb-1 flex items-center gap-1 text-emerald/60">
              <Terminal className="h-2.5 w-2.5" />
              build
            </div>
            {logLines.length === 0 ? (
              <p className="text-white/20">waiting for stream…</p>
            ) : (
              logLines.map((line, i) => (
                <div key={`${line}-${i}`} className="animate-fadeIn">
                  {line}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Code stream + calm canvas (no live iframe) */}
        <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-rows-1 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">
                src/Component.tsx
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {streamCode.lineCount} lines
                {streamCode.isComplete
                  ? ""
                  : isGenerating
                    ? " · streaming"
                    : ""}
              </span>
            </div>
            <pre
              ref={codeScrollRef}
              className="flex-1 overflow-auto bg-[#0a0a0a] p-3 font-mono text-[11px] leading-relaxed text-zinc-300"
            >
              {entryPreview ? (
                <>
                  {streamCode.isMulti && streamCode.files && (
                    <span className="mb-2 block text-[10px] text-orange-400/90">
                      {Object.keys(streamCode.files).length} files · showing
                      entry
                    </span>
                  )}
                  {entryPreview}
                  {!streamCode.isComplete && isGenerating && (
                    <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-orange-400 align-middle" />
                  )}
                </>
              ) : (
                <span className="text-zinc-600">
                  {isGenerating
                    ? phase === "planning" || phase === "connecting"
                      ? "// planning component structure…"
                      : "// waiting for code fence…"
                    : "// no code yet"}
                </span>
              )}
            </pre>
          </div>

          {/* v0-style placeholder canvas — no thrashing iframe */}
          <div className="relative flex min-h-0 flex-col bg-zinc-950">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Preview
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-orange-300/90">
                <Loader2 className="h-3 w-3 animate-spin" />
                {isGenerating ? "Building…" : "Ready"}
              </span>
            </div>
            <div
              className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-6"
              style={{ background: theme.bg || "#09090b" }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.08),_transparent_55%)]" />

              {/* Device / card skeleton */}
              <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-white/15" />
                  <span className="h-2 w-2 rounded-full bg-white/15" />
                  <span className="h-2 w-2 rounded-full bg-white/15" />
                  <span className="ml-2 font-mono text-[9px] text-white/25">
                    localhost preview
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  <div className="h-3 w-24 animate-pulse rounded bg-orange-500/20" />
                  <div className="h-8 w-[80%] max-w-[240px] animate-pulse rounded-lg bg-white/10" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-[83%] animate-pulse rounded bg-white/5" />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-16 animate-pulse rounded-xl bg-white/[0.06]"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 h-9 w-28 animate-pulse rounded-lg bg-orange-500/25" />
                </div>
              </div>

              <div className="relative z-10 mt-6 max-w-sm text-center">
                <p className="text-sm font-medium text-foreground/90">
                  {isGenerating
                    ? "Assembling your UI…"
                    : "Opening live preview"}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  We hold the interactive preview until the source is complete —
                  no mid-stream glitches. Code streams on the left.
                </p>
                {streamCode.charCount > 0 && (
                  <p className="mt-2 font-mono text-[10px] tabular-nums text-orange-400/80">
                    {streamCode.charCount.toLocaleString()} chars ·{" "}
                    {streamCode.lineCount} lines
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
