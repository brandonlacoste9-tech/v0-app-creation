/**
 * Truncation-risk estimator unit tests (tsx runner).
 * Run: npx tsx src/lib/truncation-risk.test.ts
 */
import {
  countRequestedFiles,
  estimateTruncationRisk,
  TOKENS_PER_FILE,
} from "./truncation-risk";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}

// FILE n/m format takes the total
assert(countRequestedFiles("FILE 1/15\nbuild the hero") === 15, "FILE 1/15 -> 15");
assert(countRequestedFiles("file 3 of 12 please") === 12, "file 3 of 12 -> 12");

// Fenced file headers are counted
{
  const p = [
    "```tsx // src/components/Hero.tsx",
    "code",
    "```",
    "```tsx // src/components/Footer.tsx",
    "code",
    "```",
  ].join("\n");
  assert(countRequestedFiles(p) === 2, "two fenced headers -> 2");
}

// 'N files' / 'N-page' phrasing
assert(countRequestedFiles("build a 15 files store") === 15, "'15 files' -> 15");
assert(countRequestedFiles("12-page brief for the shop") === 12, "'12-page' -> 12");

// Tiny counts are not build sizes
assert(countRequestedFiles("split into 2 files") === 0, "'2 files' -> 0");

// Path-like .tsx mentions
assert(
  countRequestedFiles("edit src/components/Hero.tsx and src/components/Nav.tsx") === 2,
  "two path mentions -> 2"
);

// Max across patterns
assert(countRequestedFiles("FILE 1/15\ntouch src/a.tsx") === 15, "max across patterns");

// Plain small prompts -> 0 (no false positive on the prompt-helper template)
assert(countRequestedFiles("build me a landing page") === 0, "small prompt -> 0");
assert(
  countRequestedFiles(
    "Build a polished UI. If multi-section: split into files (Navbar, Hero, etc.)."
  ) === 0,
  "prompt-helper template -> 0"
);

// 15-file brief at 16k -> high, suggests a higher tier
{
  const r = estimateTruncationRisk("FILE 1/15\n" + "x".repeat(500), 16384);
  assert(r.risk === "high", "15 files at 16k -> high risk");
  assert(r.requestedFiles === 15, "requestedFiles 15");
  assert(r.estimatedTokens === 15 * TOKENS_PER_FILE, "estimate = files * per-file");
  assert(r.suggestedTokens > 16384, "suggested tier above 16k");
}

// Small prompt -> low
{
  const r = estimateTruncationRisk("build me a landing page", 16384);
  assert(r.risk === "low", "small prompt -> low risk");
}

// Fits inside budget -> low
{
  const r = estimateTruncationRisk("FILE 1/8\nbuild", 16384);
  assert(r.risk === "low", "8 files at 16k -> low risk");
}

// Suggested tier covers the estimate
{
  const r = estimateTruncationRisk("build 20 files please", 16384);
  assert(r.suggestedTokens >= r.estimatedTokens, "suggested covers estimate");
}

console.log("All truncation-risk tests passed.");
