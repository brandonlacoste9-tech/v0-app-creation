/**
 * Stream outcome classification tests (node --import tsx or tsx runner).
 * Run: npx tsx src/lib/stream-outcome.test.ts
 *
 * Pins the backlog item-1 contract: incomplete output is never marked
 * successful, and finish reasons / token usage are preserved on every
 * generation record.
 */
import {
  addUsage,
  classifyStreamOutcome,
  toStreamResult,
  TRUNCATED_FINISH_REASONS,
  type StreamResult,
  parseStreamCompletion,
  toStreamCompletion,
} from "./stream-outcome";
import strictAssert from "node:assert/strict";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`stream-outcome: ${msg}`);
}

function res(
  text: string,
  finishReason: string | undefined | null,
  completed: boolean
): StreamResult {
  return { text, finishReason: finishReason ?? null, completed, usage: null };
}

// Clean completion with text → success
{
  const r = toStreamResult("hello", "stop", null);
  assert(r.completed, "stop should complete");
  assert(r.finishReason === "stop", "stop reason preserved");
  assert(classifyStreamOutcome(r) === "success", "clean + text = success");
}

// finish_reason=length with text → truncated, never success
{
  const r = toStreamResult("partial…", "length", {
    promptTokens: 100,
    completionTokens: 200,
    totalTokens: 300,
  });
  assert(!r.completed, "length must not complete");
  assert(r.finishReason === "length", "length reason preserved");
  assert(r.usage?.totalTokens === 300, "usage preserved");
  assert(r.usage !== null, "tokens recorded (never null when provider sends them)");
  assert(classifyStreamOutcome(r) === "truncated", "length = truncated");
}

// Anthropic stop reason max_tokens → truncated
{
  const r = toStreamResult("partial…", "max_tokens", {
    promptTokens: 50,
    completionTokens: 120,
    totalTokens: 170,
  });
  assert(!r.completed, "max_tokens must not complete");
  assert(r.finishReason === "max_tokens", "Anthropic stop reason preserved");
  assert(classifyStreamOutcome(r) === "truncated", "max_tokens = truncated");
}

// EOF with no terminal event → interrupted (the old bug: partial text was
// returned as a normal completion)
{
  const r = toStreamResult("partial…", undefined, null);
  assert(r.finishReason === "interrupted", "missing terminal event → interrupted");
  assert(!r.completed, "no terminal event must not complete");
  assert(classifyStreamOutcome(r) === "interrupted", "EOF w/o terminal = interrupted");
  assert(classifyStreamOutcome(r) !== "success", "interrupted never success");
}

// Threw mid-stream → interrupted even with text buffered
{
  const r = res("partial…", null, false);
  assert(classifyStreamOutcome(r, true) === "interrupted", "threw = interrupted");
}

// Completed but empty → failed (nothing usable came back)
{
  const r = toStreamResult("", "stop", null);
  assert(classifyStreamOutcome(r) === "failed", "completed but empty = failed");
}

// No result at all → failed
{
  assert(classifyStreamOutcome(null) === "failed", "null result = failed");
}

// Anthropic end_turn → success
{
  const r = toStreamResult("done", "end_turn", {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
  });
  assert(r.completed, "end_turn completes");
  assert(classifyStreamOutcome(r) === "success", "end_turn + text = success");
}

// stop_sequence → success
{
  const r = toStreamResult("done", "stop_sequence", null);
  assert(r.completed, "stop_sequence completes");
  assert(classifyStreamOutcome(r) === "success", "stop_sequence = success");
}

// tool_calls on a final round (no pending tools executed) → not completed
{
  const r = toStreamResult("text…", "tool_calls", null);
  assert(!r.completed, "tool_calls is not a text terminal");
  assert(classifyStreamOutcome(r) === "interrupted", "unresolved tool_calls = interrupted");
}

// Truncation reasons set is exact — stop must never be in it
{
  assert(TRUNCATED_FINISH_REASONS.has("length"), "length in truncated set");
  assert(TRUNCATED_FINISH_REASONS.has("max_tokens"), "max_tokens in truncated set");
  assert(!TRUNCATED_FINISH_REASONS.has("stop"), "stop not truncated");
}

// addUsage accumulates across rounds and tolerates missing fragments
{
  let u = addUsage(null, { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 });
  assert(u?.totalTokens === 150, "first fragment recorded");
  u = addUsage(u, { prompt_tokens: 0, completion_tokens: 40, total_tokens: 40 });
  assert(u?.promptTokens === 100 && u?.completionTokens === 90 && u?.totalTokens === 190, "accumulates");
  u = addUsage(u, null);
  assert(u?.totalTokens === 190, "null fragment keeps accumulator");
  u = addUsage(u, { prompt_tokens: null, completion_tokens: null, total_tokens: null });
  assert(u?.totalTokens === 190, "empty fragment keeps accumulator");
}

console.log("stream-outcome tests: all passed");

// Wire/storage normalization preserves all four terminal states, including
// failed-with-no-result, whose finish reason is null rather than "stop".
for (const result of [null, toStreamResult("", "stop", null),
  toStreamResult("code", "stop", null), toStreamResult("code", "length", null),
  toStreamResult("code", undefined, null)]) {
  const completion = toStreamCompletion(result);
  strictAssert.deepEqual(parseStreamCompletion(completion), completion);
}
strictAssert.equal(parseStreamCompletion({ finishReason: null, truncated: false })?.status, "interrupted");
