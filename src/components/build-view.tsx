"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  BUILD_STEPS,
  getBuildPhase,
  getVirtualFiles,
  isLikelyRenderable,
  phaseIndex,
  type StreamCodeState,
} from "@/lib/stream-code";
import { wrapCodeForPreview } from "@/lib/preview-html";
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
}

const BUILD_LOG_LINES: Record<string, string[]> = {
  connecting: ["→ opening model channel…", "→ handshake ok"],
  planning: [
    "→ analyzing product intent…",
    "→ choosing layout system (flex / grid)",
    "→ selecting Tailwind tokens",
  ],
  scaffolding: [
    "→ mkdir src/",
    "→ touch src/Component.tsx",
    "→ write package.json",
  ],
  writing: [
    "→ streaming JSX…",
    "→ wiring hooks (useState / useMemo)",
    "→ composing sections",
  ],
  styling: [
    "→ applying Tailwind utilities…",
    "→ responsive breakpoints sm/md/lg",
    "→ contrast & spacing pass",
  ],
  mounting: [
    "→ Babel transpile",
    "→ ReactDOM.createRoot",
    "→ hydrate #root",
  ],
  done: ["✓ build complete — preview ready"],
};

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

  const [previewCode, setPreviewCode] = useState("");
  const [showLive, setShowLive] = useState(false);
  const lastUpdate = useRef(0);
  const lastLen = useRef(0);
  const codeScrollRef = useRef<HTMLPreElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

  // Throttled live preview updates while streaming
  useEffect(() => {
    const previewSource =
      streamCode.entryCode ||
      (streamCode.files && Object.values(streamCode.files).join("\n")) ||
      streamCode.code;
    if (!previewSource) {
      if (!isGenerating) {
        setPreviewCode("");
        setShowLive(false);
      }
      return;
    }

    const now = Date.now();
    const grew = streamCode.charCount - lastLen.current >= 160;
    const timed = now - lastUpdate.current >= 900;
    const complete = streamCode.isComplete;
    const sourceForCheck = streamCode.code || previewSource;

    if (
      (complete || ((grew || timed) && isLikelyRenderable(sourceForCheck))) &&
      sourceForCheck !== previewCode
    ) {
      lastUpdate.current = now;
      lastLen.current = streamCode.charCount;
      setPreviewCode(sourceForCheck);
      setShowLive(true);
    }
  }, [streamCode, isGenerating, previewCode]);

  useEffect(() => {
    if (codeScrollRef.current) {
      codeScrollRef.current.scrollTop = codeScrollRef.current.scrollHeight;
    }
  }, [streamCode.code]);

  const [logLines, setLogLines] = useState<string[]>([]);
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

  const srcDoc = useMemo(() => {
    if (!previewCode) return "";
    return wrapCodeForPreview(previewCode, theme);
  }, [previewCode, theme]);

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
                  "Live generation"}
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
                  active && "border-orange-500/40 bg-orange-500/10 text-orange-300",
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
        {/* File tree */}
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
                {f.status === "done" && <Check className="h-3 w-3 shrink-0 text-emerald" />}
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

        {/* Code stream + live preview split */}
        <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-rows-1 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">
                src/Component.tsx
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {streamCode.lineCount} lines
                {streamCode.isComplete ? "" : isGenerating ? " · streaming" : ""}
              </span>
            </div>
            <pre
              ref={codeScrollRef}
              className="flex-1 overflow-auto bg-[#0a0a0a] p-3 font-mono text-[11px] leading-relaxed text-zinc-300"
            >
              {streamCode.entryCode || streamCode.files ? (
                <>
                  {streamCode.isMulti && streamCode.files && (
                    <span className="mb-2 block text-[10px] text-orange-400/90">
                      {Object.keys(streamCode.files).length} files · showing entry
                    </span>
                  )}
                  {streamCode.entryCode ||
                    (streamCode.files && Object.values(streamCode.files)[0]) ||
                    ""}
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

          <div className="relative flex min-h-0 flex-col bg-zinc-900">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Live preview
              </span>
              {showLive ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" />
                  {streamCode.isComplete ? "Synced" : "Updating…"}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  Waiting for JSX…
                </span>
              )}
            </div>
            <div className="relative min-h-0 flex-1">
              {showLive && srcDoc ? (
                <iframe
                  key={previewCode.slice(0, 40) + String(streamCode.lineCount)}
                  title="Building preview"
                  srcDoc={srcDoc}
                  sandbox="allow-scripts"
                  className="h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-2 w-2 animate-bounce rounded-full bg-orange-400/80"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isGenerating
                      ? "UI will appear as soon as enough JSX streams in"
                      : "Start a generation to watch the build"}
                  </p>
                  {/* Skeleton wireframe while waiting */}
                  {isGenerating && (
                    <div className="mt-2 w-full max-w-xs space-y-2 opacity-40">
                      <div className="h-8 animate-pulse rounded-md bg-white/10" />
                      <div className="h-24 animate-pulse rounded-md bg-white/10" />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-12 animate-pulse rounded-md bg-white/10" />
                        <div className="h-12 animate-pulse rounded-md bg-white/10" />
                        <div className="h-12 animate-pulse rounded-md bg-white/10" />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isGenerating && showLive && !streamCode.isComplete && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background/80 to-transparent" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
