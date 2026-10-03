/**
 * Durable per-file checkpoints for a truncated generation.
 *
 * Closed fences are the source of truth. The open tail is in-progress and is
 * the only file a Continue repair may replace. Nothing here invents closers.
 */
import { analyzeSourceTruncation } from "./code-truncation";
import {
  classifyStreamFiles,
  parseProject,
  serializeProject,
  type ProjectFiles,
  type StreamFileClassification,
} from "./project-files";
import type { StreamCompletion } from "./stream-outcome";
import { resolveBabel } from "./preview-fixtures/guards";

export function completeFilesSignature(classified: StreamFileClassification): string {
  const keys = Object.keys(classified.complete).sort();
  return keys.map((k) => `${k}\0${classified.complete[k]}`).join("\0\0");
}

/** Closed files plus the open tail (tail never overwrites a closed path). */
export function checkpointSnapshot(classified: StreamFileClassification): {
  files: ProjectFiles;
  entry: string;
  truncated: string[];
} | null {
  const files: ProjectFiles = { ...classified.complete };
  const truncated: string[] = [];
  const tail = classified.inProgress;
  if (tail?.body.trim() && !files[tail.path]) {
    files[tail.path] = tail.body;
    truncated.push(tail.path);
  }
  // Closed fence, cut-off body (unclosed JSX tag, unterminated string):
  // same per-file detection as extractProjectFromResponse so the streaming
  // checkpoint badge and the repair merge see the same truncated list.
  for (const [path, body] of Object.entries(files)) {
    if (truncated.includes(path)) continue;
    if (!/\.(tsx|jsx|ts|js)$/i.test(path)) continue;
    try {
      if (body?.trim() && analyzeSourceTruncation(body).likelyTruncated) {
        truncated.push(path);
      }
    } catch {
      // A detector throw must never break checkpointing.
    }
  }
  const paths = Object.keys(files).filter((p) => files[p]?.trim());
  if (!paths.length) return null;
  const entry = files["src/Component.tsx"]?.trim()
    ? "src/Component.tsx"
    : paths[0];
  return { files, entry, truncated };
}

export function serializeCheckpoint(classified: StreamFileClassification): string | null {
  const snap = checkpointSnapshot(classified);
  if (!snap) return null;
  return serializeProject(snap.files, snap.entry, snap.truncated);
}

/**
 * Detects a Continue-repair send: the checkpointed single-file repair prompt
 * (or the legacy truncation prompt). Used to keep repair bookkeeping in one
 * place instead of sniffing prompt strings at each call site.
 */
export function isContinueRepairPrompt(prompt: string): boolean {
  return (
    prompt.includes("Return ONLY the missing remainder") ||
    prompt.includes("Completed files are already checkpointed") ||
    prompt.includes("CUT OFF mid-file")
  );
}

export function readTruncatedPaths(code: string): string[] {
  const fromBundle = parseProject(code).truncated;
  if (fromBundle?.length) return [...fromBundle];
  return [];
}

export function checkpointProgressTitle(code: string): string | null {
  const project = parseProject(code);
  const truncated = readTruncatedPaths(code);
  if (!truncated.length) return null;
  const total = Object.keys(project.files).filter((p) => project.files[p]?.trim()).length;
  const complete = Math.max(0, total - truncated.length);
  return `${complete} of ${total} files — truncated`;
}

/**
 * Ask the model for the incomplete files only.
 * Finished checkpoint bytes are not sent back for a rewrite.
 */
/**
 * Which truncated file a Continue repair targets. Repairs are single-file by
 * design: one repair prompt asks for ONE file's missing remainder, because a
 * prompt demanding every incomplete file at once is unanswerable when many
 * files are truncated (the model dodges with a prose claim instead). The
 * studio auto-chains: one Continue click walks the truncated list file by
 * file until none remain or a repair makes no progress.
 */
export function nextRepairTarget(code: string): string | null {
  const project = parseProject(code);
  return readTruncatedPaths(code).find((p) => project.files[p]) ?? null;
}

export function buildContinueRepairPrompt(code: string, onlyPath?: string): string {
  const project = parseProject(code);
  const target =
    (onlyPath && project.files[onlyPath] ? onlyPath : null) ??
    nextRepairTarget(code);
  const paths = readTruncatedPaths(code).filter((p) => project.files[p]);
  if (!target) {
    return [
      "The previous generation was CUT OFF mid-file.",
      "Continue and complete every incomplete file from where it stopped.",
      "Return FULL complete sources for each file that is still incomplete (not a sketch).",
      "Keep files that already compiled — do not restart the product.",
      "Entry must define function Component(). Do not claim the preview compiles.",
    ].join("\n");
  }
  const body = project.files[target] || "";
  const reasons = analyzeSourceTruncation(body).reasons.slice(0, 3);
  const diag = reasons.length
    ? ` Our syntax checker found: ${reasons.join("; ")}.`
    : "";
  const remaining =
    paths.length > 1
      ? ` (${paths.length - 1} more incomplete file(s) after this one: ${paths
          .filter((p) => p !== target)
          .join(", ")})`
      : "";
  return [
    "The previous generation was CUT OFF. Completed files are already checkpointed.",
    `FILE ${target} — finish this file only, from the cutoff.${diag}${remaining}`,
    "Return ONLY the missing remainder of this file in one closed fence:",
    "```tsx file=\"" + target + "\"",
    body.replace(/\s*$/, ""),
    "```",
    "Do not repeat any of the shown text — output ONLY the exact lines that continue from the cutoff point to the end of the file.",
    "Do not return any other file. Do not restart the product or restyle finished files.",
    "This file is INCOMPLETE even if it looks finished — write the real remainder: the missing closing tags, braces, or JSX the checker named above, through the end of the file.",
    "Do not paste a placeholder or claim it compiles.",
    "OUTPUT OVERRIDE for this repair: skip PLAN and SUMMARY entirely. Your reply must be ONLY the fenced remainder — no preamble, no explanation, no claim of completeness. A reply without a closed code fence is discarded and burns the repair.",
  ].join("\n\n");
}

export interface CheckpointMerge {
  code: string;
  incomplete: string[];
  /**
   * Paths whose merged bytes actually changed vs the checkpointed base.
   * A model re-emission that reproduces the base byte-for-byte is NOT a
   * replacement — counting it as one is what let dead repairs re-qualify
   * for another chain attempt.
   */
  replaced: string[];
  /** replaced paths that left the incomplete list this round (measured improvement). */
  healed: string[];
}

/**
 * Chain to another file only when this repair made real progress:
 * byte-level change AND measured improvement (at least one file healed).
 * An identical-output reproduction burned a generation and must never
 * qualify for another attempt, whatever the analyzer says about it.
 */
export function shouldChainCheckpointRepair(
  repair: CheckpointMerge,
  depth: number,
  maxDepth: number,
  completion?: StreamCompletion
): boolean {
  return (
    repair.incomplete.length > 0 &&
    depth < maxDepth &&
    (!completion || completion.status === "success") &&
    repair.replaced.length > 0 &&
    repair.healed.length > 0
  );
}

/**
 * Tail-splice for Continue repairs. The repair prompt asks the model for ONLY
 * the missing remainder of a truncated file (re-emitting a whole 400-line
 * file is what keeps truncating the repair itself). The returned text is
 * appended to the checkpointed truncated body:
 * - If the model re-emitted the whole file anyway (it contains the file's
 *   first line), the tail is used as the whole file (previous behavior).
 * - Otherwise an overlapping seam is stripped: models often repeat the last
 *   few lines they saw, so the longest suffix/prefix line overlap (up to 12
 *   lines) is de-duplicated before appending.
 *
 * The cutoff seam is preserved EXACTLY — no newline or whitespace is ever
 * injected between the head and the remainder. The old code trimmed the
 * head and forced a `\n`, so a cutoff inside `"Hel` with a remainder
 * starting `lo"` spliced into an invalid multiline string — which the
 * truncation checker still scored as complete (its scanner does not model
 * the no-newline-inside-a-string rule).
 *
 * Never invents closers — the appended text is verbatim model output, and
 * the truncation checker still verdicts the spliced result.
 */
export function spliceRepairTail(head: string, tail: string): string {
  const headLines = head.split("\n");
  const tailLines = tail.split("\n");
  const firstHead = headLines.find((l) => l.trim()) ?? "";
  if (firstHead && tailLines.some((l) => l === firstHead)) {
    return tail;
  }
  const nonEmptyHead = headLines.filter((l) => l.trim());
  let overlap = 0;
  const maxOverlap = Math.min(12, nonEmptyHead.length, tailLines.length);
  for (let k = maxOverlap; k > 0; k--) {
    const headTail = nonEmptyHead.slice(-k).join("\n");
    const tailHead = tailLines.slice(0, k).join("\n");
    if (headTail === tailHead) {
      overlap = k;
      break;
    }
  }
  const restLines = tailLines.slice(overlap);
  while (restLines.length && !restLines[0].trim()) restLines.shift();
  if (overlap > 0) {
    // The stripped overlap block ended with a line break in the model's
    // output, so the remainder continues on a fresh line: add one break
    // only when the head doesn't already end with one.
    return head + (head.endsWith("\n") ? "" : "\n") + restLines.join("\n");
  }
  // No overlap: the remainder continues from the exact cutoff point —
  // mid-token, mid-line, or at a line boundary. Joining verbatim is the
  // only seam that can't corrupt the file.
  return head + restLines.join("\n");
}

/**
 * True when the merged file parses as TSX (Babel react + typescript
 * presets — the same parser family the preview iframe uses).
 *
 * The truncation checker alone cannot catch a newline spliced inside a
 * double/single-quoted string (its scanner never models the no-newline
 * rule), so the merge validates with a real parser before marking a file
 * repaired. Optional dependency: where @babel/standalone can't be loaded
 * (e.g. the browser bundle) this returns true and the truncation analysis
 * is the only check — it never blocks a repair it can't verify.
 */
export function mergedSourceParses(code: string): boolean {
  const Babel = resolveBabel();
  if (!Babel) return true;
  try {
    Babel.transform(code, {
      presets: [
        ["typescript", { isTSX: true, allExtensions: true }],
        ["react", { runtime: "classic" }],
      ],
      filename: "repair.tsx",
      sourceType: "module",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Path-keyed repair. Checkpointed files stay byte-identical even if the
 * model also returns them. Returns null when the base has no truncated list
 * (legacy Continue — caller keeps the full-extract save).
 */
export function mergeCheckpointRepair(
  baseCode: string,
  modelText: string
): CheckpointMerge | null {
  const allowed = readTruncatedPaths(baseCode);
  if (!allowed.length) return null;
  const base = parseProject(baseCode);
  const incoming = classifyStreamFiles(modelText);
  const files: ProjectFiles = { ...base.files };
  const replaced: string[] = [];
  const incomplete: string[] = [];

  for (const path of allowed) {
    const closed =
      incoming.complete[path] ??
      (incoming.inProgress?.path === path ? incoming.inProgress.body : null);
    if (!closed || !closed.trim()) {
      incomplete.push(path);
      continue;
    }
    const baseBody = base.files[path] ?? "";
    const spliced = spliceRepairTail(baseBody, closed);
    files[path] = spliced;
    // Only byte-level change counts as a replacement. An identical-output
    // reproduction leaves the file alone — listing it as replaced would
    // let a dead repair chain again (up to 12 wasted generations).
    if (spliced !== baseBody) {
      replaced.push(path);
    }
    // The merged file must parse before it's marked repaired. The splice is
    // verbatim model output at a raw cutoff seam, so validate it with a
    // real parser: an invalid merge stays flagged as incomplete (it can
    // take another repair round) instead of being declared healed while
    // broken. The truncation checker alone is not enough — it still scored
    // the old newline-injected `"Hel\nlo"` splice as complete.
    if (
      analyzeSourceTruncation(spliced).likelyTruncated ||
      !mergedSourceParses(spliced)
    ) {
      incomplete.push(path);
    }
  }

  const incompleteSet = new Set(incomplete);
  const healed = replaced.filter((path) => !incompleteSet.has(path));
  return {
    code: serializeProject(files, base.entry, incomplete),
    incomplete,
    replaced,
    healed,
  };
}
