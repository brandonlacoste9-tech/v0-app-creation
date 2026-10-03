/**
 * Pre-send truncation-risk estimation.
 *
 * A generation that needs more output tokens than the studio's maxTokens
 * will truncate mid-file. This module estimates the likely output size from
 * the prompt *before* a generation is spent, so the UI can offer a one-click
 * max-tokens raise instead of burning a generation on a truncated build.
 *
 * The estimate combines three signals, because prompt text alone undercounts
 * real builds:
 *  - explicitly requested files (prompt heuristics in countRequestedFiles),
 *  - structured requirements the text cannot say reliably: the wizard's
 *    catalog size (products re-emitted in the code) and the existing source
 *    (iterative updates re-emit code), passed in via StructuredEstimateContext,
 *  - headroom on top of the whole estimate, because the per-file average is
 *    optimistic.
 *
 * Heuristic only — a false negative just means no warning; the
 * post-generation truncation detection (analyzeSourceTruncation) remains the
 * safety net.
 */

/** Rough average output tokens per requested file. */
export const TOKENS_PER_FILE = 1200;

/** Headroom multiplier applied to the whole estimate: raw averages run low. */
export const ESTIMATE_HEADROOM = 1.25;

/**
 * Rough output tokens per catalog product re-emitted in a store build.
 * Each product rides the PRODUCTS literal (id, sku, title, description,
 * image, price, gtin, brand) — the card/detail markup itself is shared.
 */
export const TOKENS_PER_CATALOG_PRODUCT = 120;

/** Rough characters per output token when re-emitting existing source. */
export const SOURCE_CHARS_PER_TOKEN = 4;

/**
 * Structured estimation inputs — things the prompt text alone cannot say
 * reliably. Supplied by callers that know the build: the studio chat panel
 * passes the wizard's StoreBrief and the current code; the agent store API
 * can pass the brief directly (see backlog #4).
 */
export interface StructuredEstimateContext {
  /** Files the build must emit (e.g. the wizard brief's named file list). */
  expectedFiles?: number;
  /** Catalog products the build must re-emit (wizard StoreBrief.products). */
  catalogSize?: number;
  /** Existing source in chars (iterative updates re-emit code). */
  existingSourceChars?: number;
}

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
 *  - named multi-file lists: "Multi-file: Header, ProductGrid, Footer."
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

  // Named multi-file lists: "Multi-file: Header, ProductGrid, Footer."
  // The store wizard ends its brief with one; a lone component mention may
  // be prose, so this only counts lists of two or more PascalCase names.
  // Trailing punctuation per item ("Component;") is stripped, not dropped.
  const multiFileRe = /multi-file:\s*([^\n.]+)/gi;
  while ((m = multiFileRe.exec(prompt)) !== null) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim().replace(/[^A-Za-z0-9_]+$/, ""))
      .filter((s) => /^[A-Z][A-Za-z0-9_]*$/.test(s));
    if (names.length >= 2) best = Math.max(best, names.length);
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

/** Sanitize an optional structured count: finite, non-negative integer. */
function sanitizeCount(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0
    ? Math.floor(n)
    : 0;
}

/**
 * Estimate truncation risk for a prompt at the given maxTokens budget.
 *
 * Combines the prompt's requested-file count (taking the max with the
 * structured expectedFiles when a caller supplies one) with the structured
 * signals — catalogSize products re-emitted in the code, existing source
 * re-emitted on updates — then applies the headroom multiplier.
 */
export function estimateTruncationRisk(
  prompt: string,
  maxTokens: number,
  ctx?: StructuredEstimateContext
): TruncationRisk {
  const requestedFiles = Math.max(
    countRequestedFiles(prompt),
    sanitizeCount(ctx?.expectedFiles)
  );
  const catalogSize = sanitizeCount(ctx?.catalogSize);
  const sourceTokens = Math.ceil(
    sanitizeCount(ctx?.existingSourceChars) / SOURCE_CHARS_PER_TOKEN
  );
  const rawEstimate =
    requestedFiles * TOKENS_PER_FILE +
    catalogSize * TOKENS_PER_CATALOG_PRODUCT +
    sourceTokens;
  const estimatedTokens = Math.ceil(rawEstimate * ESTIMATE_HEADROOM);
  // With no estimation signal at all the estimate is 0 and the guard stays
  // quiet; any signal (files, catalog, existing source) that outruns the
  // budget holds the send.
  const hasSignal =
    requestedFiles > 0 || catalogSize > 0 || sourceTokens > 0;
  const suggestedTokens =
    RAISE_TIERS.find((t) => t >= estimatedTokens) ?? MAX_RAISE_TOKENS;
  return {
    risk: hasSignal && estimatedTokens > maxTokens ? "high" : "low",
    requestedFiles,
    estimatedTokens,
    maxTokens,
    suggestedTokens,
  };
}
