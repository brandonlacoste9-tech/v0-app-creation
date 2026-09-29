/**
 * Regression guard: the structural contract the model must obey.
 * The wizard's #1 failure mode is malformed code (bare top-level return,
 * unbalanced braces, truncated files) — the prompts must explicitly forbid it.
 * Run: npx tsx src/lib/ai-prompt.test.ts
 */
import assert from "node:assert/strict";
import { SYSTEM_PROMPT, getStoreSystemPrompt } from "./ai";
import { buildStoreBrief, buildStoreUserPrompt } from "./commerce/store-brief";

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
