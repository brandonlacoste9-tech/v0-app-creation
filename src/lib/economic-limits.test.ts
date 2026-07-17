/**
 * Run: npx tsx src/lib/economic-limits.test.ts
 */
import {
  checkAndConsume,
  getEconomicQuotas,
  getUsageSnapshot,
} from "./economic-limits";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

{
  const free = getEconomicQuotas("free");
  assert(free.tokensPerDay === 50_000, "free token budget");
  assert(free.telemetryEventsPerDay === 200, "free telem");
  const max = getEconomicQuotas("max");
  assert((max.tokensPerDay ?? 0) > (free.tokensPerDay ?? 0), "max > free");
}

async function main() {
  const tenant = `test-tenant-${Date.now()}`;
  const snap0 = await getUsageSnapshot(tenant, "free");
  assert(snap0.telemetry_events === 0, "start zero");

  // Burst: free allows 20 telemetry/min
  for (let i = 0; i < 20; i++) {
    const r = await checkAndConsume(tenant, "free", "telemetry_events", 1);
    assert(r.allowed, `burst ok ${i}`);
  }
  const burst = await checkAndConsume(tenant, "free", "telemetry_events", 1);
  assert(!burst.allowed, "21st burst blocked");
  if (!burst.allowed) assert(burst.code === "burst_telemetry", "burst code");

  // Token budget (separate tenant — no burst on tokens)
  const t2 = `test-tokens-${Date.now()}`;
  const tok = await checkAndConsume(t2, "free", "tokens", 40_000);
  assert(tok.allowed, "tokens ok");
  const tok2 = await checkAndConsume(t2, "free", "tokens", 20_000);
  assert(!tok2.allowed, "token budget hard stop");
  if (!tok2.allowed) {
    assert(tok2.status === 429, "429");
    assert(tok2.code === "quota_tokens", "quota_tokens");
  }

  console.log("economic-limits tests: all passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
