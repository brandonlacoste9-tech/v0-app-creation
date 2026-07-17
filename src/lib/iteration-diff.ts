/**
 * Iteration Diff — compare two Shipboard version snapshots (raw project code).
 * Used by the studio Changes tab (not the preview stripper / ship path).
 */
import { parseProject, type ProjectFiles } from "./project-files";

export type FileChangeKind = "added" | "removed" | "modified" | "unchanged";

export type DiffLineKind = "context" | "add" | "del";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** 1-based line numbers; null for pure add/del sides */
  oldNo: number | null;
  newNo: number | null;
}

export interface FileDiff {
  path: string;
  kind: FileChangeKind;
  additions: number;
  deletions: number;
  /** Human impact hint e.g. "actions · route" */
  impact: string;
  lines: DiffLine[];
}

export interface IterationDiffReport {
  baseLabel: string;
  headLabel: string;
  files: FileDiff[];
  /** Files with real changes only */
  changedFiles: FileDiff[];
  totalAdditions: number;
  totalDeletions: number;
  hasChanges: boolean;
}

/** Classify path for impact chips */
export function impactHintForPath(path: string): string {
  const p = path.replace(/\\/g, "/").toLowerCase();
  const hints: string[] = [];
  if (p.includes("action") || p.endsWith("actions.ts") || p.endsWith("actions.tsx")) {
    hints.push("actions");
  }
  if (
    p.includes("page.") ||
    p.includes("route.") ||
    p.includes("/app/") ||
    p.endsWith("layout.tsx")
  ) {
    hints.push("route");
  }
  if (p.includes("schema") || p.includes("/db/") || p.includes("drizzle")) {
    hints.push("schema");
  }
  if (p.includes("component") || p.includes("/components/")) {
    hints.push("ui");
  }
  if (p.endsWith(".css")) hints.push("styles");
  if (hints.length === 0) hints.push("file");
  return hints.slice(0, 3).join(" · ");
}

/**
 * Line-level LCS diff (Myers-ish via classic DP). Fine for studio file sizes.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.length ? oldText.replace(/\r\n/g, "\n").split("\n") : [];
  const b = newText.length ? newText.replace(/\r\n/g, "\n").split("\n") : [];
  const n = a.length;
  const m = b.length;
  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "context", text: a[i], oldNo: oldNo++, newNo: newNo++ });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: a[i], oldNo: oldNo++, newNo: null });
      i++;
    } else {
      out.push({ kind: "add", text: b[j], oldNo: null, newNo: newNo++ });
      j++;
    }
  }
  while (i < n) {
    out.push({ kind: "del", text: a[i], oldNo: oldNo++, newNo: null });
    i++;
  }
  while (j < m) {
    out.push({ kind: "add", text: b[j], oldNo: null, newNo: newNo++ });
    j++;
  }
  return out;
}

function countDeltas(lines: DiffLine[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const l of lines) {
    if (l.kind === "add") additions++;
    if (l.kind === "del") deletions++;
  }
  return { additions, deletions };
}

function filesMap(code: string): ProjectFiles {
  return parseProject(code || "").files;
}

/**
 * Compare two stored version `code` payloads (plain TSX or multi-file JSON).
 */
export function compareVersionCodes(
  baseCode: string,
  headCode: string,
  labels?: { baseLabel?: string; headLabel?: string }
): IterationDiffReport {
  const baseFiles = filesMap(baseCode);
  const headFiles = filesMap(headCode);
  const paths = new Set([
    ...Object.keys(baseFiles),
    ...Object.keys(headFiles),
  ]);
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));

  const files: FileDiff[] = [];
  for (const path of sorted) {
    const oldC = baseFiles[path] ?? "";
    const newC = headFiles[path] ?? "";
    let kind: FileChangeKind = "unchanged";
    if (!baseFiles[path] && headFiles[path]) kind = "added";
    else if (baseFiles[path] && !headFiles[path]) kind = "removed";
    else if (oldC !== newC) kind = "modified";

    const lines =
      kind === "added"
        ? newC.split("\n").map((text, idx) => ({
            kind: "add" as const,
            text,
            oldNo: null,
            newNo: idx + 1,
          }))
        : kind === "removed"
          ? oldC.split("\n").map((text, idx) => ({
              kind: "del" as const,
              text,
              oldNo: idx + 1,
              newNo: null,
            }))
          : diffLines(oldC, newC);

    const { additions, deletions } = countDeltas(lines);
    files.push({
      path,
      kind,
      additions,
      deletions,
      impact: impactHintForPath(path),
      lines: kind === "unchanged" ? [] : lines,
    });
  }

  const changedFiles = files.filter((f) => f.kind !== "unchanged");
  const totalAdditions = changedFiles.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = changedFiles.reduce((s, f) => s + f.deletions, 0);

  return {
    baseLabel: labels?.baseLabel ?? "previous",
    headLabel: labels?.headLabel ?? "current",
    files,
    changedFiles,
    totalAdditions,
    totalDeletions,
    hasChanges: changedFiles.length > 0,
  };
}

/** Prefer entry / actions / largest delta for default selection */
export function pickDefaultDiffPath(report: IterationDiffReport): string | null {
  if (!report.changedFiles.length) return null;
  const scored = report.changedFiles.map((f) => {
    let score = f.additions + f.deletions;
    const p = f.path.toLowerCase();
    if (p.includes("component")) score += 50;
    if (p.includes("action")) score += 40;
    if (p.includes("page")) score += 30;
    if (f.kind === "added") score += 10;
    return { path: f.path, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.path ?? null;
}

/** Collapse long unchanged runs in display (keep edges) */
export function collapseContext(
  lines: DiffLine[],
  contextRadius = 3
): DiffLine[] {
  if (lines.length === 0) return lines;
  const keep = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].kind !== "context") {
      for (
        let k = Math.max(0, i - contextRadius);
        k <= Math.min(lines.length - 1, i + contextRadius);
        k++
      ) {
        keep.add(k);
      }
    }
  }
  // If almost all context-only, show full file truncated
  if (keep.size === 0) {
    return lines.slice(0, 80);
  }
  const out: DiffLine[] = [];
  let i = 0;
  while (i < lines.length) {
    if (keep.has(i)) {
      out.push(lines[i]);
      i++;
      continue;
    }
    // skip run of non-kept
    let j = i;
    while (j < lines.length && !keep.has(j)) j++;
    const skipped = j - i;
    if (skipped > 0) {
      out.push({
        kind: "context",
        text: `… ${skipped} unchanged lines …`,
        oldNo: null,
        newNo: null,
      });
    }
    i = j;
  }
  return out;
}
