import assert from "node:assert/strict";
import { test } from "node:test";
import { streamChat } from "./api-client";

const encoder = new TextEncoder();
function streamed(chunks: string[]): Response {
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }));
}

async function observe(response: Response) {
  const originalFetch = globalThis.fetch;
  const deltas: string[] = [];
  const completions: unknown[][] = [];
  const errors: Array<{ message: string; flags: unknown }> = [];
  globalThis.fetch = async () => response;
  try {
    streamChat("test-session", "build", "groq", "test-model", "", "", 0.7,
      (delta) => deltas.push(delta), undefined, undefined,
      (...args) => completions.push(args),
      (message, flags) => errors.push({ message, flags }));
    // The in-memory response drains in microtasks before this next turn.
    await new Promise<void>((resolve) => setImmediate(resolve));
    return { deltas, completions, errors };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("HTTP errors reach the studio instead of leaving it building forever", async () => {
  const result = await observe(Response.json({
    error: "Session access denied", upgrade: true, needsAuth: true,
  }, { status: 403 }));
  assert.deepEqual(result.errors, [{
    message: "Session access denied", flags: { upgrade: true, needsAuth: true },
  }]);
  assert.equal(result.completions.length, 0);
});

test("non-JSON HTTP errors still report their status", async () => {
  const result = await observe(new Response("upstream timeout", { status: 504 }));
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /504|timeout/i);
});

test("finish reason and usage reach the completion callback", async () => {
  const completion = {
    finishReason: "length", truncated: true,
    usage: { promptTokens: 20, completionTokens: 1024, totalTokens: 1044 },
  };
  const result = await observe(streamed([
    'data: {"type":"delta","text":"partial"}\n\n',
    `data: ${JSON.stringify({ type: "done", ...completion })}\n\n`,
  ]));
  assert.deepEqual(result.deltas, ["partial"]);
  assert.equal(result.completions.length, 1);
  assert.equal((result.completions[0][0] as typeof completion)?.finishReason, "length");
  assert.deepEqual((result.completions[0][0] as typeof completion)?.usage, completion.usage);
});

test("the last buffered event is processed even without a trailing newline", async () => {
  const result = await observe(streamed([
    'data: {"type":"delta","text":"last lines"}\n\n',
    'data: {"type":"done","finishReason":"stop","truncated":false}',
  ]));
  assert.deepEqual(result.deltas, ["last lines"]);
  assert.equal(result.completions.length, 1);
  assert.equal(result.errors.length, 0);
});

test("EOF without a terminal event is an interruption", async () => {
  const result = await observe(streamed(['data: {"type":"delta","text":"partial"}\n\n']));
  assert.deepEqual(result.deltas, ["partial"]);
  assert.equal(result.completions.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /interrupt|ended|incomplete/i);
});

test("an error event is terminal and is delivered exactly once", async () => {
  const result = await observe(streamed([
    'data: {"type":"error","error":"Provider unavailable"}\n\n',
    'data: {"type":"done","finishReason":"stop"}\n\n',
  ]));
  assert.equal(result.errors.length, 1);
  assert.equal(result.completions.length, 0);
});

test("chunk boundaries and malformed frames do not lose valid output", async () => {
  const result = await observe(streamed([
    'data: not-json\n\ndata: {"type":"del',
    'ta","text":"Bonjour"}\r\n\r\ndata:{"type":"done","finishReason":"stop"}\n\n',
    'data: {"type":"done","finishReason":"length"}\n\n',
  ]));
  assert.deepEqual(result.deltas, ["Bonjour"]);
  assert.equal(result.completions.length, 1);
  assert.equal(result.errors.length, 0);
});
