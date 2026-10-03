/**
 * Agent API tests: auth helper + generation error paths.
 * Run: npx tsx src/lib/agent/agent.test.ts
 */
import { requireAgentAuth } from "./auth";
import {
  generateStoreFromBrief,
  resolveAgentMaxTokens,
} from "./generate";
import { buildStoreBrief } from "@/lib/commerce/store-brief";
import { parseProject } from "@/lib/project-files";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(`ASSERT: ${m}`);
}

async function main() {
  // ── AUTH: no token → 401 ──
  {
    const req = new Request("https://shipboard.ca/api/agent/stores");
    const result = await requireAgentAuth(req);
    assert("response" in result, "missing token returns response");
    assert(result.response.status === 401, "missing token → 401");
    const body = await result.response.json();
    assert(body.error === "API key required", "helpful error message");
  }

  // ── AUTH: invalid token → 401 ──
  {
    const req = new Request("https://shipboard.ca/api/agent/stores", {
      headers: { Authorization: "Bearer sb_pat_invalid123" },
    });
    const result = await requireAgentAuth(req);
    assert("response" in result, "invalid token returns response");
    assert(result.response.status === 401, "invalid token → 401");
  }

  // ── AUTH: wrong scheme → 401 ──
  {
    const req = new Request("https://shipboard.ca/api/agent/stores", {
      headers: { Authorization: "Token sb_pat_abc" },
    });
    const result = await requireAgentAuth(req);
    assert("response" in result, "wrong scheme returns response");
    assert(result.response.status === 401, "wrong scheme → 401");
  }

  // ── GENERATION: unknown provider ──
  {
    const brief = buildStoreBrief({
      storeName: "Test Store",
      vibe: "clean",
      products: [{ name: "Widget", price: 25 }],
    });
    const r = await generateStoreFromBrief({
      brief,
      provider: "nonexistent",
      apiKey: "dummy",
    });
    assert(!r.ok, "unknown provider fails");
    assert(!!r.error?.includes("Unknown provider"), "unknown provider error");
  }

  // ── GENERATION: missing API key ──
  {
    const brief = buildStoreBrief({
      storeName: "Test Store",
      vibe: "clean",
      products: [{ name: "Widget", price: 25 }],
    });
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    const r = await generateStoreFromBrief({ brief, provider: "groq" });
    assert(!r.ok, "missing API key fails");
    assert(!!r.error?.includes("No API key"), "missing key error");
    if (saved) process.env.GROQ_API_KEY = saved;
  }

  // ── BUDGET: resolveAgentMaxTokens clamps ──
  {
    assert(resolveAgentMaxTokens(undefined) === 8192, "default 8192");
    assert(resolveAgentMaxTokens("x" as never) === 8192, "garbage → default");
    assert(resolveAgentMaxTokens(1) === 1024, "floor 1024");
    assert(resolveAgentMaxTokens(999999) === 65536, "ceiling 65536");
    assert(resolveAgentMaxTokens(16000) === 16000, "mid-range passes through");
  }

  // ── Mock provider harness ──
  const seenBodies: Record<string, unknown>[] = [];
  const scripted: Array<{
    finishReason: string | null;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
    text: string;
    anthropic?: boolean;
  }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
    seenBodies.push(JSON.parse(String(init?.body ?? "{}")));
    const s = scripted.shift();
    if (!s) throw new Error("no scripted response");
    if (s.anthropic) {
      return new Response(
        JSON.stringify({
          stop_reason: s.finishReason,
          usage: s.usage
            ? { input_tokens: s.usage.prompt_tokens, output_tokens: s.usage.completion_tokens }
            : null,
          content: [{ type: "text", text: s.text }],
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: s.text }, finish_reason: s.finishReason }],
        usage: s.usage,
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const brief = () =>
    buildStoreBrief({
      storeName: "Test Store",
      vibe: "clean",
      products: [{ name: "Widget", price: 25 }],
    });

  const cleanComponent = '```tsx file="src/Component.tsx"\nexport default function App() {\n  return <div>Hello</div>;\n}\n```';

  // ── BUDGET: maxTokens threads into the provider call ──
  {
    scripted.push({
      finishReason: "stop",
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      text: cleanComponent,
    });
    const r = await generateStoreFromBrief({
      brief: brief(),
      provider: "groq",
      apiKey: "dummy",
      maxTokens: 16000,
    });
    assert(seenBodies[seenBodies.length - 1].max_tokens === 16000, "maxTokens → provider max_tokens");
    assert(r.ok, "clean stop is ok");
    assert(r.completion.status === "success", "stop → success");
    assert(r.completion.finishReason === "stop", "finishReason retained");
    assert(r.completion.usage?.completionTokens === 200, "usage retained");
  }

  // ── STOP REASONS: provider truncation is explicitly incomplete ──
  {
    scripted.push({
      finishReason: "length",
      usage: { prompt_tokens: 100, completion_tokens: 8192, total_tokens: 8292 },
      text: cleanComponent,
    });
    const r = await generateStoreFromBrief({
      brief: brief(),
      provider: "xai",
      apiKey: "dummy",
    });
    assert(!r.ok, "provider truncation is never ok:true");
    assert(r.completion.truncated, "completion.truncated set");
    assert(r.completion.finishReason === "length", "finishReason retained");
    assert(r.error?.includes("maxTokens"), "error names the budget knob");
    assert(seenBodies[seenBodies.length - 1].max_tokens === 8192, "default budget 8192 when unspecified");
  }

  // ── ANTHROPIC: stop_reason + usage parsed ──
  {
    scripted.push({
      finishReason: "max_tokens",
      usage: { prompt_tokens: 50, completion_tokens: 4000, total_tokens: 4050 },
      text: "",
      anthropic: true,
    });
    const r = await generateStoreFromBrief({
      brief: brief(),
      provider: "anthropic",
      apiKey: "dummy",
    });
    assert(!r.ok, "anthropic empty+truncated fails");
    assert(r.completion.truncated, "anthropic max_tokens → truncated");
    assert(r.completion.usage?.promptTokens === 50, "anthropic usage mapped");
    assert(r.error?.includes("maxTokens"), "budget guidance in error");
  }

  // ── METADATA: truncated-file list + completion survive serialization ──
  {
    const multiTruncated =
      '```tsx file="src/Component.tsx"\nexport default function App() {\n  return <div>Hello</div>;\n}\n```\n' +
      '```tsx file="src/Header.tsx"\nexport function Header() {\n  const items = [1, 2,';
    scripted.push({
      finishReason: "length",
      usage: { prompt_tokens: 100, completion_tokens: 8192, total_tokens: 8292 },
      text: multiTruncated,
    });
    const r = await generateStoreFromBrief({
      brief: brief(),
      provider: "deepseek",
      apiKey: "dummy",
    });
    assert(!r.ok, "truncated multi-file is explicitly incomplete");
    assert(r.code, "code still returned for inspection");
    const parsed = parseProject(r.code!);
    assert(
      parsed.truncated.includes("src/Header.tsx"),
      "proj.truncated recorded in saved bundle",
    );
    assert(
      parsed.completion?.status === "truncated",
      "completion record recorded in saved bundle",
    );
  }

  globalThis.fetch = realFetch;

  // ── BRIEF: validation ──
  {
    let threw = false;
    try {
      buildStoreBrief({ storeName: "Empty", products: [] });
    } catch {
      threw = true;
    }
    assert(threw, "empty products rejected");

    const b = buildStoreBrief({
      storeName: "Priced",
      vibe: "street",
      products: [{ name: "Cap", price: "$32.00" }],
    });
    assert(b.products[0].priceCents === 3200, "string price → cents");
    assert(b.vibe === "street", "vibe preserved");
    assert(b.designStyle === "street", "designStyle from vibe");
  }
}

main().then(
  () => console.log("agent API tests passed"),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
