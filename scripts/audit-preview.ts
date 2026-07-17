/**
 * Smoke-test starter seeds through sanitize → safe → Babel → mount.
 * Run: npx tsx scripts/audit-preview.ts
 */
import * as BabelNS from "@babel/standalone";
import { STARTER_SEEDS } from "../src/lib/starter-gallery";
import { sanitizePreviewSource } from "../src/lib/preview-html";
import {
  analyzeSourceTruncation,
  makePreviewSafeSource,
  countUnmatchedJsxClosers,
} from "../src/lib/code-truncation";
import { tryMountEntry } from "../src/lib/preview-fixtures/guards";

const Babel: {
  transform: (code: string, opts: object) => { code?: string | null };
} =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BabelNS as any).default?.transform
    ? (BabelNS as any).default
    : (BabelNS as any);

let failed = 0;
let passed = 0;

function check(id: string, code: string) {
  const t0 = Date.now();
  console.log(`… ${id} (${code.length} chars)`);
  const analysis = analyzeSourceTruncation(code);
  const unmatched = countUnmatchedJsxClosers(code);
  const cleaned = sanitizePreviewSource(code);
  const safe = makePreviewSafeSource(cleaned);

  let babelOk = false;
  let babelErr = "";
  let mountOk = false;
  let mountErr = "";
  try {
    const r = Babel.transform(safe.code, {
      presets: [["react", { runtime: "classic" }]],
      filename: "Component.jsx",
      sourceType: "script",
    });
    if (!r.code) throw new Error("empty babel output");
    babelOk = true;
    const mount = tryMountEntry(r.code);
    if (mount.ok) mountOk = true;
    else mountErr = mount.error;
  } catch (e) {
    babelErr = e instanceof Error ? e.message.split("\n")[0] : String(e);
  }

  // Starters must compile without fallback
  const ok = babelOk && mountOk && !safe.usedFallback;
  const ms = Date.now() - t0;

  if (ok) {
    passed++;
    console.log(`  ok   ${id} ${ms}ms`);
  } else {
    failed++;
    console.error(`  FAIL ${id} ${ms}ms`);
    console.error(
      `       trunc=${analysis.likelyTruncated} reasons=${JSON.stringify(analysis.reasons)}`
    );
    console.error(
      `       unmatched=${unmatched} fallback=${safe.usedFallback} deltas b/p=${analysis.braceDelta}/${analysis.parenDelta}`
    );
    console.error(`       babel=${babelOk} ${babelErr}`);
    console.error(`       mount=${mountOk} ${mountErr}`);
  }
}

console.log("=== STARTER SEEDS ===", STARTER_SEEDS.length);
for (const seed of STARTER_SEEDS) {
  check(seed.id, seed.code);
}

check(
  "simple-min",
  `function Component() {
  return <div className="p-8 text-white bg-zinc-950">Hello</div>;
}`
);

check(
  "with-map-price",
  `function Component() {
  const plans = [
    { name: "Free", price: 0 },
    { name: "Pro", price: 25 },
  ];
  return (
    <div className="p-8">
      {plans.map((p) => (
        <div key={p.name}>{p.name}: {p.price}</div>
      ))}
    </div>
  );
}`
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
