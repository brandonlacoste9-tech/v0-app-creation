"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CodeVersion } from "@/lib/types";
import {
  collapseContext,
  compareVersionCodes,
  pickDefaultDiffPath,
  type FileChangeKind,
  type FileDiff,
} from "@/lib/iteration-diff";
import { emitPreviewMetric } from "@/lib/preview-metrics";
import {
  Check,
  Copy,
  FileCode2,
  FilePlus2,
  FileMinus2,
  FileDiff as FileDiffIcon,
  GitCompare,
  Code2,
} from "lucide-react";

interface IterationDiffPanelProps {
  versions: CodeVersion[];
  activeVersionIndex: number;
  /** Jump to Code tab + optional path */
  onJumpToCode?: (path: string) => void;
  className?: string;
}

function kindIcon(kind: FileChangeKind) {
  if (kind === "added") return FilePlus2;
  if (kind === "removed") return FileMinus2;
  return FileDiffIcon;
}

function kindLabel(kind: FileChangeKind) {
  if (kind === "added") return "+";
  if (kind === "removed") return "−";
  return "Δ";
}

export function IterationDiffPanel({
  versions,
  activeVersionIndex,
  onJumpToCode,
  className,
}: IterationDiffPanelProps) {
  const [vsBase, setVsBase] = useState(false);
  /** User override; null = use pickDefaultDiffPath */
  const [userSelectedPath, setUserSelectedPath] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);
  const viewedKeyRef = useRef<string>("");

  const headIdx = Math.max(0, Math.min(activeVersionIndex, versions.length - 1));
  const baseIdx = vsBase ? 0 : Math.max(0, headIdx - 1);

  const report = useMemo(() => {
    if (versions.length === 0) {
      return compareVersionCodes("", "", {
        baseLabel: "—",
        headLabel: "—",
      });
    }
    if (versions.length === 1 || headIdx === 0) {
      // First version: show full file as "added" vs empty
      return compareVersionCodes("", versions[headIdx].code, {
        baseLabel: "empty",
        headLabel: `v${headIdx + 1}`,
      });
    }
    const base = versions[baseIdx];
    const head = versions[headIdx];
    return compareVersionCodes(base.code, head.code, {
      baseLabel: vsBase ? "v1 (base)" : `v${baseIdx + 1}`,
      headLabel: `v${headIdx + 1}`,
    });
  }, [versions, headIdx, baseIdx, vsBase]);

  const selectedPath = useMemo(() => {
    if (
      userSelectedPath &&
      report.changedFiles.some((f) => f.path === userSelectedPath)
    ) {
      return userSelectedPath;
    }
    return pickDefaultDiffPath(report);
  }, [report, userSelectedPath]);

  useEffect(() => {
    const key = `${report.baseLabel}|${report.headLabel}|${vsBase}`;
    if (viewedKeyRef.current === key) return;
    viewedKeyRef.current = key;
    emitPreviewMetric("iteration_diff_viewed", {
      files: report.changedFiles.length,
      additions: report.totalAdditions,
      deletions: report.totalDeletions,
      vsBase,
    });
  }, [report, vsBase]);

  const selected: FileDiff | undefined = report.changedFiles.find(
    (f) => f.path === selectedPath
  );

  const displayLines = useMemo(
    () => (selected ? collapseContext(selected.lines, 3) : []),
    [selected]
  );

  const selectFile = (path: string) => {
    setUserSelectedPath(path);
    emitPreviewMetric("diff_file_selected", { path: path.slice(0, 80) });
  };

  const acceptAll = () => {
    setReviewed(new Set(report.changedFiles.map((f) => f.path)));
    emitPreviewMetric("changes_accepted", {
      files: report.changedFiles.length,
    });
  };

  const copyHunk = async () => {
    if (!selected) return;
    const text = selected.lines
      .filter((l) => l.kind !== "context" || !l.text.startsWith("…"))
      .map((l) => {
        if (l.kind === "add") return `+ ${l.text}`;
        if (l.kind === "del") return `- ${l.text}`;
        return `  ${l.text}`;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (versions.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground",
          className
        )}
      >
        <GitCompare className="h-8 w-8 opacity-40" />
        <p>No versions yet — generate a UI to see changes.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      {/* Top bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/60 px-3 py-2">
        <GitCompare className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-xs font-semibold text-foreground">
          {report.baseLabel} → {report.headLabel}
        </span>
        {report.hasChanges ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            <span className="text-emerald">+{report.totalAdditions}</span>
            {" / "}
            <span className="text-red-400">−{report.totalDeletions}</span>
            {" · "}
            {report.changedFiles.length} file
            {report.changedFiles.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">No changes</span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {versions.length > 1 && (
            <button
              type="button"
              onClick={() => setVsBase((v) => !v)}
              className={cn(
                "rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                vsBase
                  ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title="Compare against first generation instead of previous version"
            >
              {vsBase ? "vs Base generation" : "vs Previous"}
            </button>
          )}
          <button
            type="button"
            onClick={acceptAll}
            disabled={!report.hasChanges}
            className="rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            title="Mark all changed files as reviewed (local only)"
          >
            {reviewed.size > 0 &&
            reviewed.size >= report.changedFiles.length ? (
              <span className="flex items-center gap-1 text-emerald">
                <Check className="h-3 w-3" /> Reviewed
              </span>
            ) : (
              "Accept all"
            )}
          </button>
        </div>
      </div>

      {!report.hasChanges ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <FileCode2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No file differences between {report.baseLabel} and {report.headLabel}.
          </p>
          <p className="max-w-sm text-[11px] text-muted-foreground/80">
            Iterate in chat or Continue after a truncated gen — this tab shows
            what the last prompt changed.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_1fr]">
          {/* File list */}
          <aside className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
            <div className="border-b border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Changed files
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
              {report.changedFiles.map((f) => {
                const Icon = kindIcon(f.kind);
                const active = f.path === selectedPath;
                const isReviewed = reviewed.has(f.path);
                return (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => selectFile(f.path)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition-colors",
                      active
                        ? "bg-orange-500/15 text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "font-mono text-[11px] font-bold",
                          f.kind === "added" && "text-emerald",
                          f.kind === "removed" && "text-red-400",
                          f.kind === "modified" && "text-amber-500"
                        )}
                      >
                        {kindLabel(f.kind)}
                      </span>
                      <Icon className="h-3 w-3 shrink-0 opacity-70" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                        {f.path.split("/").pop()}
                      </span>
                      {isReviewed && (
                        <Check className="h-3 w-3 shrink-0 text-emerald" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 pl-5 font-mono text-[9px] opacity-70">
                      <span className="text-emerald">+{f.additions}</span>
                      <span className="text-red-400">−{f.deletions}</span>
                      <span className="truncate">{f.impact}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Diff viewer */}
          <div className="flex min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                {selected?.path || "Select a file"}
              </span>
              {selected && (
                <>
                  <button
                    type="button"
                    onClick={() => onJumpToCode?.(selected.path)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Code2 className="h-3 w-3" />
                    Jump to Code
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyHunk()}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied ? "Copied" : "Copy hunk"}
                  </button>
                </>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[#0a0a0a] font-mono text-[11px] leading-relaxed">
              {!selected ? (
                <p className="p-4 text-muted-foreground">Select a file</p>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {displayLines.map((line, i) => (
                      <tr
                        key={i}
                        className={cn(
                          line.kind === "add" && "bg-emerald/10",
                          line.kind === "del" && "bg-red-500/10",
                          line.text.startsWith("…") && "text-muted-foreground/50"
                        )}
                      >
                        <td className="w-10 select-none border-r border-white/5 px-1 text-right text-[9px] text-white/25">
                          {line.oldNo ?? ""}
                        </td>
                        <td className="w-10 select-none border-r border-white/5 px-1 text-right text-[9px] text-white/25">
                          {line.newNo ?? ""}
                        </td>
                        <td
                          className={cn(
                            "whitespace-pre-wrap break-all px-2 py-0.5",
                            line.kind === "add" && "text-emerald-300/90",
                            line.kind === "del" && "text-red-300/90",
                            line.kind === "context" && "text-zinc-400"
                          )}
                        >
                          <span className="mr-1 inline-block w-3 opacity-50">
                            {line.kind === "add"
                              ? "+"
                              : line.kind === "del"
                                ? "−"
                                : " "}
                          </span>
                          {line.text}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
