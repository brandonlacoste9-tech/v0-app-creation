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
import { classifyStreamFiles, serializeProject } from "./project-files";
import { toStreamCompletion, toStreamResult } from "./stream-outcome";
import {
  DEFAULT_MAX_TOKENS,
  qualifiesForFreeRepair,
  repairHitExhaustion,
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

// A Continue at the studio's lowest setting must not truncate again at 1k.
assert.equal(resolveEffectiveMaxTokens(undefined, 1024, true), 16384);
assert.equal(resolveEffectiveMaxTokens(1024, 2048, true), 16384);
assert.equal(resolveEffectiveMaxTokens(undefined, 32768, true), 32768);
assert.equal(resolveEffectiveMaxTokens(undefined, 1024, false), 1024);
assert.equal(resolveEffectiveMaxTokens(undefined, NaN, true), 16384);
assert.equal(resolveEffectiveMaxTokens(undefined, -1, false), DEFAULT_MAX_TOKENS);

// The model may run out of tokens between closed files, without open syntax.
const limitedBetweenFiles = serializeProject({ "src/A.tsx": "function A() { return <p>Done</p>; }" },
  "src/A.tsx", [], toStreamCompletion(toStreamResult("code", "length", null)));
assert.equal(qualifiesForFreeRepair(true, limitedBetweenFiles), true);
assert.equal(qualifiesForFreeRepair(false, limitedBetweenFiles), false);

// A repair inherits the original generation's effective budget: a one-send
// guard raise on the original build is not lost when the user hits Continue.
assert.equal(
  resolveEffectiveMaxTokens(undefined, 16384, true, { baseBudget: 65536 }),
  65536,
  "repair keeps the original generation's raised budget"
);
assert.equal(
  resolveEffectiveMaxTokens(undefined, 1024, true, { baseBudget: 32768 }),
  32768,
  "repair keeps the original budget even at the lowest slider setting"
);
assert.equal(
  resolveEffectiveMaxTokens(undefined, 65536, true, { baseBudget: 16384 }),
  65536,
  "a higher current studio budget still wins for the repair"
);
assert.equal(
  resolveEffectiveMaxTokens(undefined, 1024, true, { baseBudget: 1024 }),
  16384,
  "the model-supported minimum still applies with a repair context"
);
assert.equal(
  resolveEffectiveMaxTokens(65536, 1024, true, { baseBudget: 16384 }),
  65536,
  "a one-send override on the repair send itself is honored"
);

// Consecutive provider-exhausted repair attempts double the budget, capped at
// the platform's raise ceiling.
assert.equal(
  resolveEffectiveMaxTokens(undefined, 16384, true, { baseBudget: 16384, exhaustionRaises: 1 }),
  32768,
  "one exhausted repair doubles the next repair's budget"
);
assert.equal(
  resolveEffectiveMaxTokens(undefined, 16384, true, { baseBudget: 32768, exhaustionRaises: 2 }),
  65536,
  "exhaustion raises cap at the platform ceiling"
);
assert.equal(
  resolveEffectiveMaxTokens(undefined, 16384, true, { baseBudget: 65536, exhaustionRaises: 5 }),
  65536,
  "raises never exceed the ceiling no matter the streak"
);
assert.equal(
  resolveEffectiveMaxTokens(200000, 16384, true, { baseBudget: 200000 }),
  65536,
  "the inherited budget itself is capped at the platform ceiling"
);
assert.equal(
  resolveEffectiveMaxTokens(undefined, 1024, true, { baseBudget: 16384, exhaustionRaises: 1 }),
  32768,
  "the raise applies on top of the inherited budget, not the slider"
);
assert.equal(
  resolveEffectiveMaxTokens(undefined, 1024, true, { baseBudget: -5, exhaustionRaises: NaN }),
  16384,
  "garbage repair context falls back to the minimum"
);

// Non-repair sends ignore the repair context entirely.
assert.equal(
  resolveEffectiveMaxTokens(undefined, 1024, false, { baseBudget: 65536, exhaustionRaises: 3 }),
  1024,
  "repair context never leaks into normal sends"
);

// Only provider-reported exhaustion (finish_reason length / max_tokens)
// raises the next repair's budget.
assert.equal(repairHitExhaustion({ truncated: true }), true);
assert.equal(repairHitExhaustion({ truncated: false }), false);
assert.equal(repairHitExhaustion(undefined), false);
assert.equal(repairHitExhaustion(null), false);
assert.equal(
  repairHitExhaustion(toStreamCompletion(toStreamResult("code", "length", null))),
  true,
  "a length-truncated stream completion counts as exhaustion"
);
assert.equal(
  repairHitExhaustion(toStreamCompletion(toStreamResult("code", "stop", null))),
  false,
  "a cleanly stopped stream is not exhaustion"
);
assert.equal(
  repairHitExhaustion(toStreamCompletion(toStreamResult("code", undefined, null))),
  false,
  "an interrupted stream (no terminal event) is not exhaustion"
);

console.log("All token-guard tests passed.");
