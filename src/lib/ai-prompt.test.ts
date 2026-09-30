/**
 * Regression guard: the structural contract the model must obey.
 * The wizard's #1 failure mode is malformed code (bare top-level return,
 * unbalanced braces, truncated files) — the prompts must explicitly forbid it.
 * Run: npx tsx src/lib/ai-prompt.test.ts
 */
import assert from "node:assert/strict";
import { SYSTEM_PROMPT, getEffectiveSystemPrompt, getStoreSystemPrompt } from "./ai";
import { buildStoreBrief, buildStoreUserPrompt } from "./commerce/store-brief";
import { buildContinueTruncationPrompt } from "./code-truncation";

assert.ok(
  SYSTEM_PROMPT.includes("STRUCTURE (non-negotiable)"),
  "system prompt carries the structural contract"
);
assert.ok(
  SYSTEM_PROMPT.includes("NEVER emit a bare top-level `return`"),
  "system prompt forbids bare top-level return"
);
assert.ok(
  SYSTEM_PROMPT.includes("a file that starts with `return (` is broken"),
  "system prompt names the exact failure shape"
);

const brief = buildStoreBrief({
  storeName: "Probe Goods",
  products: [{ name: "Test Mug", price: 25 }],
});
const storeSys = getStoreSystemPrompt(brief);
assert.ok(
  storeSys.includes("never a bare top-level return"),
  "store system prompt forbids bare top-level return"
);

const wizardPrompt = buildStoreUserPrompt(brief);
assert.ok(
  wizardPrompt.includes("never a bare top-level return"),
  "wizard user prompt forbids bare top-level return"
);
assert.ok(
  wizardPrompt.includes("never an unfinished file"),
  "wizard user prompt demands complete files"
);

console.log("ai-prompt.test.ts: all assertions passed");

// Repair mode: a Continue-repair send must override the PLAN/SUMMARY
// structure and the iteration "full files" rule at the SYSTEM level.
// A user-message-only override loses to the system prompt, the model
// re-emits PLAN + full rewrite + SUMMARY, the rewrite truncates again,
// and the repair never converges (Bee's nike store: 5 dead versions).
const brandKitOff = {
  enabled: false,
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  fontFamily: "",
  buttonStyle: "rounded",
  tone: "professional",
  logoUrl: "",
};
const repairPrompt = getEffectiveSystemPrompt(brandKitOff, "", undefined, {
  designStyle: "auto",
  userMessage: "The previous generation was CUT OFF. Return ONLY the missing remainder",
  repairMode: true,
});
assert.ok(
  repairPrompt.includes("## REPAIR MODE"),
  "repair mode appends the REPAIR MODE block"
);
assert.ok(
  repairPrompt.includes("No PLAN. No SUMMARY."),
  "repair mode forbids PLAN/SUMMARY at the system level"
);
// The example fence must be real triple-backticks — an over-escaped
// fence (\\`) would teach the model a broken format and the repair
// would never converge.
const fenceExample = repairPrompt.indexOf("```tsx file=");
assert.ok(
  fenceExample > 0,
  "repair mode shows a real ```tsx fence example"
);
assert.ok(
  repairPrompt[fenceExample - 1] !== "\\",
  "repair fence example is not backslash-escaped"
);
assert.ok(
  !repairPrompt.includes("## CURRENT PROJECT (iterate"),
  "repair mode skips the iteration full-files prompt"
);
const normalPrompt = getEffectiveSystemPrompt(brandKitOff, "", undefined, {
  designStyle: "auto",
  userMessage: "hello",
});
assert.ok(
  !normalPrompt.includes("## REPAIR MODE"),
  "normal sends do not get the REPAIR MODE block"
);
assert.ok(
  normalPrompt.includes("a) PLAN"),
  "normal sends keep the PLAN/CODE/SUMMARY structure"
);

console.log("ai-prompt.test.ts: repair-mode assertions passed");

// 2026-09-30 live probe: the system-only REPAIR MODE override lost to the
// generic Continue user message ("Return FULL complete sources... not only
// the missing tail"), so the model re-emitted PLAN + full rewrite + SUMMARY
// and the repair never converged. System and user message must agree on the
// no-prose contract — pin both sides.
assert.ok(
  repairPrompt.includes("FULL complete sources"),
  "repair mode covers the generic full-sources case, not just remainder-only"
);
assert.ok(
  repairPrompt.includes("missing remainder"),
  "repair mode still covers the targeted remainder-only case"
);
const genericContinue = buildContinueTruncationPrompt();
assert.ok(
  genericContinue.includes("No PLAN. No SUMMARY."),
  "generic Continue prompt carries the no-prose contract in the user message itself"
);
assert.ok(
  !genericContinue.includes("not only the missing tail"),
  "generic Continue prompt no longer contradicts the repair-mode system block"
);
assert.ok(
  genericContinue.includes("CUT OFF mid-file"),
  "generic Continue prompt still matches the repair-send detector"
);

console.log("ai-prompt.test.ts: repair-contract agreement assertions passed");
