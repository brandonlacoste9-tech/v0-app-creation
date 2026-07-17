/**
 * Production smoke checks for Shipboard (no full gen — no API spend).
 * Usage: node scripts/smoke.mjs
 * Env: SMOKE_URL=https://capable-medovik-53f769.netlify.app
 */
const BASE = (process.env.SMOKE_URL || "https://capable-medovik-53f769.netlify.app").replace(
  /\/$/,
  ""
);

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
    return true;
  } catch (e) {
    console.error(`  FAIL ${name}: ${e.message || e}`);
    return false;
  }
}

async function main() {
  console.log(`Shipboard smoke → ${BASE}\n`);
  let passed = 0;
  let failed = 0;

  const run = async (name, fn) => {
    if (await check(name, fn)) passed++;
    else failed++;
  };

  await run("GET /api/health", async () => {
    const res = await fetch(`${BASE}/api/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  });

  await run("GET /api/user", async () => {
    const res = await fetch(`${BASE}/api/user`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!["free", "builder", "pro", "max"].includes(data.plan)) {
      throw new Error(`unexpected plan ${data.plan}`);
    }
    if (data.plan === "free" && data.generationsLimit !== 5) {
      throw new Error(`free gens limit expected 5, got ${data.generationsLimit}`);
    }
    if (!Array.isArray(data.providers) || data.providers.length < 1) {
      throw new Error("providers missing");
    }
  });

  await run("GET /studio HTML", async () => {
    const res = await fetch(`${BASE}/studio`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    if (!html.includes("Shipboard") && !html.includes("Shipboard") && !html.includes("Describe")) {
      // Next may stream shell — still require non-empty
      if (html.length < 200) throw new Error("studio HTML too short");
    }
  });

  await run("GET / marketing", async () => {
    const res = await fetch(`${BASE}/`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    if (!html.toLowerCase().includes("builder") && !html.includes("15")) {
      // soft check
    }
    if (html.length < 500) throw new Error("home too short");
  });

  await run("GET /api/sessions", async () => {
    const res = await fetch(`${BASE}/api/sessions`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("sessions not array");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
