import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProject, serializeProject } from "./project-files";
import { getShipReadyUi, validateForShip } from "./gen-integrity";
import { attachCommerceFilesToCode } from "./commerce/attach";

const files = {
  "src/Component.tsx": 'function Component() { return <main><h1>Our collection</h1><p>Browse the store.</p></main>; }',
};
const completion = {
  finishReason: "length", completed: false, status: "truncated" as const,
  truncated: true, usage: { promptTokens: 200, completionTokens: 1024, totalTokens: 1224 },
};

test("a token-limited stream stays incomplete after save and reload", () => {
  const code = serializeProject(files, "src/Component.tsx", [], completion);
  assert.deepEqual(parseProject(code).completion, completion);
});

test("closed files do not make a token-limited stream ready to ship", () => {
  const code = JSON.stringify({ v: 1, entry: "src/Component.tsx", files, completion });
  const gate = validateForShip(code);
  assert.equal(gate.ok, false);
  assert.ok(gate.issues.some((issue) => issue.code === "ship_truncated"));
  assert.equal(getShipReadyUi(code, false).primaryAction, "continue");
});

test("adding commerce files preserves the provider completion state", () => {
  const code = JSON.stringify({ v: 1, entry: "src/Component.tsx", files, completion });
  const attached = attachCommerceFilesToCode(code, { title: "Agent-ready store" });
  assert.ok(Object.keys(parseProject(attached).files).length > 1);
  assert.deepEqual(parseProject(attached).completion, completion);
});

test("a clean completion and legacy versions remain shippable", () => {
  const clean = { ...completion, finishReason: "stop", completed: true, status: "success" as const, truncated: false };
  assert.equal(validateForShip(serializeProject(files, "src/Component.tsx", [], clean)).ok, true);
  assert.equal(validateForShip(files["src/Component.tsx"]).ok, true);
});
