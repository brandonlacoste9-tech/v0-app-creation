/**
 * Run: npx tsx src/lib/token-guard.test.ts
 *
 * Pins the golden-path send contracts:
 *  - token-guard override send: guard triggers, "Raise to N & send" applies
 *    the one-send budget override, "Send anyway" skips the guard at the
 *    studio budget;
 *  - Continue-repair send: repair prompts are detected end to end
 *    (builder -> detector -> guard skip -> free-repair qualification),
 *    and ordinary prompts never masquerade as repairs.
 */
import assert from "node:assert/strict";
import {
  buildContinueRepairPrompt,
  isContinueRepairPrompt,
  serializeCheckpoint,
} from "./file-checkpoint";
import { classifyStreamFiles } from "./project-files";
import {
  DEFAULT_MAX_TOKENS,
  qualifiesForFreeRepair,
  resolveEffectiveMaxTokens,
  shouldShowTokenGuard,
} from "./token-guard";

/** A 12-file brief the risk estimator flags (12 * 1200 = 14.4k tokens). */
const bigBrief = Array.from(
  { length: 12 },
  (_, i) => `src/components/Widget${i}.tsx`
).join(", ");
const bigPrompt = `Build a 12-file storefront using ${bigBrief}. Production React + Tailwind, mobile-first, concrete copy, no lorem.`;

/** Truncated code bundle: one closed file + one open tail. */
function truncatedBundle(): string {
  const text =
    '```tsx file="src/A.tsx"\nfunction A() {\n  return <p>Keep</p>;\n}\n```\n' +
    '```tsx file="src/B.tsx"\nfunction B() {\n  return <div>\n';
  const c = classifyStreamFiles(text);
  return serializeCheckpoint(c)!;
}

const completeBundle =
  '```tsx file="src/A.tsx"\nfunction A() {\n  return <p>Keep</p>;\n}\n```\n';

// --- Token-guard trigger ---

{
  const risk = shouldShowTokenGuard(bigPrompt, 1024);
  assert.ok(risk, "guard holds a 12-file brief at a 1k budget");
  assert.equal(risk!.risk, "high");
  assert.equal(risk!.requestedFiles, 12);
  assert.ok(risk!.suggestedTokens >= risk!.estimatedTokens, "raise tier covers estimate");
  assert.equal(risk!.suggestedTokens, 16384, "next tier above 14.4k is 16k");
}

{
  assert.equal(
    shouldShowTokenGuard(bigPrompt, 16384),
    null,
    "same brief at a 16k budget proceeds without the guard"
  );
}

{
  assert.equal(
    shouldShowTokenGuard("a tiny hero section", 1024),
    null,
    "undetectable file count never triggers the guard"
  );
}

{
  assert.equal(
    shouldShowTokenGuard(bigPrompt, 1024, { skipTokenGuard: true }),
    null,
    "'Send anyway' / 'Raise & send' skip the guard on the follow-up send"
  );
}

// --- Guard must never eat a Continue-repair send ---

{
  const repairPrompt = buildContinueRepairPrompt(truncatedBundle());
  assert.ok(
    isContinueRepairPrompt(repairPrompt),
    "builder output is detected as a repair prompt"
  );
  assert.equal(
    shouldShowTokenGuard(repairPrompt, 1024),
    null,
    "repair sends skip the guard even at a 1k budget"
  );
}

{
  assert.equal(
    isContinueRepairPrompt(bigPrompt),
    false,
    "ordinary build prompts are never classified as repairs"
  );
  assert.equal(
    isContinueRepairPrompt("Continue the story from chapter 3"),
    false,
    "prose 'continue' is not a repair prompt"
  );
}

// --- One-send override resolution ---

{
  assert.equal(
    resolveEffectiveMaxTokens(16384, 1024),
    16384,
    "'Raise to 16k & send' applies the override for that send"
  );
  assert.equal(
    resolveEffectiveMaxTokens(undefined, 1024),
    1024,
    "'Send anyway' keeps the studio budget"
  );
  assert.equal(
    resolveEffectiveMaxTokens(undefined, undefined),
    DEFAULT_MAX_TOKENS,
    "falls back to the studio default"
  );
}

// --- Free-repair qualification (client flag + server rule agree) ---

{
  const repairPrompt = buildContinueRepairPrompt(truncatedBundle());
  const isRepairContinue = isContinueRepairPrompt(repairPrompt);
  assert.ok(
    qualifiesForFreeRepair(isRepairContinue, truncatedBundle()),
    "repair send on a truncated version rides free"
  );
  assert.equal(
    qualifiesForFreeRepair(isRepairContinue, completeBundle),
    false,
    "no incomplete files -> no free credit, even with the flag set"
  );
  assert.equal(
    qualifiesForFreeRepair(isRepairContinue, undefined),
    false,
    "missing base code -> no free credit"
  );
  assert.equal(
    qualifiesForFreeRepair(false, truncatedBundle()),
    false,
    "flag alone is not enough; and without the flag a truncated base is not free"
  );
  assert.equal(
    qualifiesForFreeRepair(isContinueRepairPrompt(bigPrompt), truncatedBundle()),
    false,
    "a normal send on a truncated version is not free"
  );
}

console.log("All token-guard tests passed.");
