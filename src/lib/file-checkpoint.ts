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
export function buildContinueRepairPrompt(code: string): string {
  const project = parseProject(code);
  const paths = readTruncatedPaths(code).filter((p) => project.files[p]);
  if (!paths.length) {
    return [
      "The previous generation was CUT OFF mid-file.",
      "Continue and complete every incomplete file from where it stopped.",
      "Return FULL complete sources for each file that is still incomplete (not a sketch).",
      "Keep files that already compiled — do not restart the product.",
      "Entry must define function Component(). Do not claim the preview compiles.",
    ].join("\n");
  }
  const blocks = paths.map((p) => {
    const body = project.files[p] || "";
    const reasons = analyzeSourceTruncation(body).reasons.slice(0, 3);
    const diag = reasons.length
      ? ` Our syntax checker found: ${reasons.join("; ")}.`
      : "";
    return [
      `FILE ${p} — finish this file only, from the cutoff.${diag}`,
      "```tsx file=\"" + p + "\"",
      body.replace(/\s*$/, ""),
      "```",
    ].join("\n");
  });
  return [
    "The previous generation was CUT OFF. Completed files are already checkpointed.",
    `Return ONLY the missing remainder of these incomplete file(s), each in one closed fence: ${paths.join(", ")}.`,
    "Do not repeat any of the shown text — output ONLY the exact lines that continue from the cutoff point to the end of the file.",
    "Do not return any other file. Do not restart the product or restyle finished files.",
    "The listed files are INCOMPLETE even if they look finished — write the real remainder: the missing closing tags, braces, or JSX the checker named above, through the end of the file.",
    "Do not paste a placeholder or claim it compiles.",
    ...blocks,
    "OUTPUT OVERRIDE for this repair: skip PLAN and SUMMARY entirely. Your reply must be ONLY the fenced remainder(s) — no preamble, no explanation, no claim of completeness. A reply without a closed code fence is discarded and burns the repair.",
  ].join("\n\n");
}

export interface CheckpointMerge {
  code: string;
  incomplete: string[];
  replaced: string[];
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
  return head.replace(/\s*$/, "") + "\n" + restLines.join("\n");
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
    const spliced = spliceRepairTail(base.files[path] ?? "", closed);
    files[path] = spliced;
    replaced.push(path);
    if (analyzeSourceTruncation(spliced).likelyTruncated) {
      incomplete.push(path);
    }
  }

  return {
    code: serializeProject(files, base.entry, incomplete),
    incomplete,
    replaced,
  };
}
