/**
 * Agent API tests: auth helper + generation error paths.
 * Run: npx tsx src/lib/agent/agent.test.ts
 */
import { requireAgentAuth } from "./auth";
import { generateStoreFromBrief } from "./generate";
import { buildStoreBrief } from "@/lib/commerce/store-brief";

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
