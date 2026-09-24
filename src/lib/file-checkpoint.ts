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
    prompt.includes("Return ONLY these incomplete") ||
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
    `Return ONLY these incomplete file(s), each in one closed fence: ${paths.join(", ")}.`,
    "Do not return any other file. Do not restart the product or restyle finished files.",
    "The listed files are INCOMPLETE even if they look finished — complete the missing closing tags, braces, or strings the checker named above.",
    "You MUST return each listed file in one closed code fence. A text-only reply with no fence is discarded and burns the repair.",
    "Write the real remainder of each file. Do not paste a placeholder or claim it compiles.",
    ...blocks,
  ].join("\n\n");
}

export interface CheckpointMerge {
  code: string;
  incomplete: string[];
  replaced: string[];
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
    const closed = incoming.complete[path];
    if (!closed) {
      incomplete.push(path);
      if (incoming.inProgress?.path === path && incoming.inProgress.body.trim()) {
        files[path] = incoming.inProgress.body;
      }
      continue;
    }
    files[path] = closed;
    replaced.push(path);
    if (analyzeSourceTruncation(closed).likelyTruncated) {
      incomplete.push(path);
    }
  }

  return {
    code: serializeProject(files, base.entry, incomplete),
    incomplete,
    replaced,
  };
}
