import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test, expect, type APIRequestContext } from "@playwright/test";

// These fixtures run against a local app only; no paid provider is called.
test.skip(!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(process.env.BASE_URL || ""),
  "Set BASE_URL to a running local Shipboard server.");

let mock: Server;
let ollamaUrl: string;
let providerBody: { options: { num_predict: number }; messages: Array<{ content: string }> };

test.beforeAll(async () => {
  mock = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    providerBody = body;
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.write(JSON.stringify({ message: { content: "```tsx file=\"src/Component.tsx\"\n" } }) + "\n");
    res.write(JSON.stringify({ message: { content: body.model === "repair-fixture"
      ? "    </main>\n  );\n}\n```"
      : "function Component() {\n  return <main>" } }) + "\n");
    if (body.model !== "interrupted-fixture") {
      // No trailing newline: exercise the provider's final buffer flush too.
      res.end(JSON.stringify({ done: true, done_reason: body.model === "length-fixture" ? "length" : "stop",
        prompt_eval_count: 20, eval_count: 30 }));
    } else {
      res.end();
    }
  });
  await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const address = mock.address();
  assert.ok(address && typeof address !== "string");
  ollamaUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (!mock) return;
  mock.closeAllConnections();
  await new Promise<void>((resolve) => mock.close(() => resolve()));
});

async function project(request: APIRequestContext) {
  const sessionId = crypto.randomUUID();
  const response = await request.post("/api/sessions", { data: { id: sessionId, title: "Fixture", model: "fixture" } });
  expect(response.ok()).toBeTruthy();
  const cookie = response.headers()["set-cookie"]?.split(";")[0] || "";
  return { sessionId, headers: { Cookie: cookie } };
}

function events(text: string) {
  return text.split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
}

test("Continue uses the repair floor and leaves the daily quota unchanged", async ({ request }) => {
  const context = await project(request);
  const previousCode = JSON.stringify({ v: 1, entry: "src/Component.tsx", files: {
    "src/Component.tsx": "function Component() {\n  return (\n    <main>\n",
  }, truncated: ["src/Component.tsx"], __ADGEN_PROJECT_V1__: true });
  const before = await (await request.get("/api/user", { headers: context.headers })).json();
  const response = await request.post("/api/chat", { headers: context.headers, data: {
    sessionId: context.sessionId, provider: "ollama", model: "repair-fixture", ollamaUrl,
    message: "The previous generation was CUT OFF mid-file. Return ONLY the missing remainder.",
    previousCode, isRepairContinue: true, maxTokens: 1024,
  } });
  expect(response.ok()).toBeTruthy();
  const stream = events(await response.text());
  expect(stream.find((event) => event.type === "done")).toMatchObject({
    status: "success", completed: true, finishReason: "stop",
    usage: { promptTokens: 20, completionTokens: 30, totalTokens: 50 },
  });
  expect(providerBody.options.num_predict).toBe(16384);
  expect(providerBody.messages[0].content).toContain("## REPAIR MODE");
  const after = await (await request.get("/api/user", { headers: context.headers })).json();
  expect(after.generationsToday).toBe(before.generationsToday);
});

for (const [model, status, finishReason] of [
  ["length-fixture", "truncated", "length"],
  ["interrupted-fixture", "interrupted", "interrupted"],
]) {
  test(`provider ${status} is reported with partial output preserved`, async ({ request }) => {
    const context = await project(request);
    const response = await request.post("/api/chat", { headers: context.headers, data: {
      sessionId: context.sessionId, provider: "ollama", model, ollamaUrl,
      message: "Build a small storefront", maxTokens: 1024,
    } });
    expect(response.ok()).toBeTruthy();
    const stream = events(await response.text());
    expect(stream.find((event) => event.type === "done")).toMatchObject({ status, finishReason, completed: false });
    expect(stream.filter((event) => event.type === "delta").map((event) => event.text).join("")).toContain("function Component()");
    expect(providerBody.options.num_predict).toBe(1024);
  });
}

test("missing-key errors do not spend generation credits", async ({ request }) => {
  const health = await (await request.get("/api/health")).json();
  test.skip(health.config.aiServerKeys.xai, "Requires a local server without an xAI key.");
  const context = await project(request);
  const before = await (await request.get("/api/user", { headers: context.headers })).json();
  for (let n = 0; n < 6; n++) {
    const response = await request.post("/api/chat", { headers: context.headers, data: {
      sessionId: context.sessionId, message: "Build a storefront", provider: "xai", model: "grok-4",
    } });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toMatch(/API key/);
  }
  const after = await (await request.get("/api/user", { headers: context.headers })).json();
  expect(after.generationsToday).toBe(before.generationsToday);
});
