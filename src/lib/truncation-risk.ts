/**
 * Pre-send truncation-risk estimation.
 *
 * A generation that needs more output tokens than the studio's maxTokens
 * will truncate mid-file. This module estimates the likely output size from
 * the prompt *before* a generation is spent, so the UI can offer a one-click
 * max-tokens raise instead of burning a generation on a truncated build.
 *
 * Heuristic only — it counts explicitly requested files. A false negative
 * just means no warning; the post-generation truncation detection
 * (analyzeSourceTruncation) remains the safety net.
 */

/** Rough average output tokens per requested file. */
export const TOKENS_PER_FILE = 1200;

/** Raise tiers offered for the one-send override (ascending). */
const RAISE_TIERS = [16384, 24576, 32768, 65536];

/**
 * Highest raise tier. Also the settings-slider ceiling, so a user who
 * regularly builds large sites can set the budget once in Settings instead
 * of hitting "Raise to 64k & send" on every guard dialog.
 */
export const MAX_RAISE_TOKENS = RAISE_TIERS[RAISE_TIERS.length - 1];

export interface TruncationRisk {
  risk: "high" | "low";
  /** Number of files the prompt appears to request (0 when undetectable). */
  requestedFiles: number;
  /** Estimated output tokens. */
  estimatedTokens: number;
  maxTokens: number;
  /** Suggested maxTokens for this send (next tier covering the estimate). */
  suggestedTokens: number;
}

/**
 * Count how many files a build prompt explicitly requests.
 * Recognizes the brief formats Shipboard prompts actually use:
 *  - "FILE 3/15" / "file 3 of 15"  -> total 15
 *  - fenced file headers: ```tsx // src/components/Hero.tsx
 *  - "15 files" / "12-page brief"
 *  - path-like mentions: src/components/Hero.tsx
 * Returns the max across patterns (0 when nothing found).
 */
export function countRequestedFiles(prompt: string): number {
  let best = 0;
  let m: RegExpExecArray | null;

  // "FILE 3/15" / "file 3 of 15"
  const ofRe = /file\s+\d+\s*(?:\/|of)\s*(\d+)/gi;
  while ((m = ofRe.exec(prompt)) !== null) {
    best = Math.max(best, parseInt(m[1], 10));
  }

  // Fenced file headers: ```tsx // path/to/Name.tsx
  const fenceRe = /```[a-z]*\s*\n?\s*\/\/\s*[^\n]*?\.(tsx|jsx)\b/gi;
  const fenced = new Set<string>();
  while ((m = fenceRe.exec(prompt)) !== null) {
    fenced.add(m[0].toLowerCase());
  }
  best = Math.max(best, fenced.size);

  // "15 files" / "12-page brief" (only meaningful counts)
  const countRe = /(\d+)\s*[-\s]?(files?|pages?)\b/gi;
  while ((m = countRe.exec(prompt)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 3) best = Math.max(best, n);
  }

  // Distinct path-like .tsx/.jsx mentions: src/components/Hero.tsx
  const pathRe = /[\w\-.]+(?:\/[\w\-.]+)+\.(tsx|jsx)\b/gi;
  const paths = new Set<string>();
  while ((m = pathRe.exec(prompt)) !== null) {
    paths.add(m[0].toLowerCase());
  }
  best = Math.max(best, paths.size);

  return best;
}

/** Estimate truncation risk for a prompt at the given maxTokens budget. */
export function estimateTruncationRisk(
  prompt: string,
  maxTokens: number
): TruncationRisk {
  const requestedFiles = countRequestedFiles(prompt);
  const estimatedTokens = requestedFiles * TOKENS_PER_FILE;
  const suggestedTokens =
    RAISE_TIERS.find((t) => t >= estimatedTokens) ?? MAX_RAISE_TOKENS;
  return {
    risk:
      requestedFiles > 0 && estimatedTokens > maxTokens ? "high" : "low",
    requestedFiles,
    estimatedTokens,
    maxTokens,
    suggestedTokens,
  };
}
