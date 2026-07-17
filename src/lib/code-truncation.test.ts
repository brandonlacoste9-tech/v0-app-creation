/**
 * Truncation state machine + JSX rebalance suite.
 * Run: npx tsx src/lib/code-truncation.test.ts
 */
import {
  analyzeSourceTruncation,
  countUnmatchedJsxClosers,
  healTruncatedSource,
  isHealedSourceViable,
  makePreviewSafeSource,
  repairJsxTagBalance,
} from "./code-truncation";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

// ── ANALYZE ──────────────────────────────────────────────────────────────

{
  const a = analyzeSourceTruncation(`function Component() {
  return <div className="p-4">OK</div>;
}`);
  assert(!a.likelyTruncated, "complete component not truncated");
  assert(a.stringState === "none", "no open string");
  assert(a.braceDelta === 0 && a.parenDelta === 0, "balanced");
}

{
  // Apostrophe in JSX prose must not open a string
  const a = analyzeSourceTruncation(`function Component() {
  return <p>You're in. We'll email you.</p>;
}`);
  assert(a.stringState === "none", "You're / We'll not string delimiters");
  assert(!a.likelyTruncated, "prose apostrophes not truncated");
}

{
  const a = analyzeSourceTruncation(`function Component() {
  return <div className="min-h-
`);
  assert(a.likelyTruncated, "mid-className detected");
  assert(a.stringState === "double", "open double string");
}

{
  const a = analyzeSourceTruncation(`function Component() {
  return (
    <div>
      <span>x</span>
    </div>))
}
}`);
  assert(a.parenDelta < 0 || a.braceDelta < 0 || a.likelyTruncated, "over-close flagged");
}

// ── repairJsxTagBalance ──────────────────────────────────────────────────

{
  const raw = `<div><span>hi</div>`; // missing </span>, wrong closer order
  const fixed = repairJsxTagBalance(raw);
  assert(fixed.includes("</span>"), "auto-close intermediate span");
  assert(countUnmatchedJsxClosers(fixed) === 0, "no unmatched after repair");
}

{
  const raw = `<div>x</div></div></main>`; // extra closers
  const fixed = repairJsxTagBalance(raw);
  assert(!fixed.includes("</main>"), "drop unmatched main closer");
  assert(fixed.match(/<\/div>/g)?.length === 1, "one div closer kept");
}

// ── HEAL mid-text + extra closers (production red panel shape) ───────────

{
  const broken = `function Component() {
  return (
    <div className="min-h-screen">
      <main className="p-8">
        <div className="card">
          <div className="copy">
You
</div>
</div>
</main>
</div>))
}
}`;
  const analysis = analyzeSourceTruncation(broken);
  assert(analysis.likelyTruncated, "mid-text+overclose flagged");

  const healed = healTruncatedSource(broken);
  const after = analyzeSourceTruncation(healed);
  assert(isHealedSourceViable(healed, after), "healed viable for Babel");
  assert(!healed.includes("\nYou\n"), "orphan You dropped");
  assert(!/\)\s*\)/.test(healed), "no double paren");

  const soft = makePreviewSafeSource(broken, { soft: true });
  assert(!soft.usedFallback || soft.code.includes("Building"), "soft path ok");

  const hard = makePreviewSafeSource(broken, { soft: false });
  // this shape heals cleanly — no fallback needed
  assert(!hard.usedFallback, "hard path uses healed source");
  assert(hard.code.includes("function Component"), "entry present");
}

// ── Open string: heal must not hang; final may fallback ──────────────────

{
  const cut = `function Component() {
  return <div className="unterminated
`;
  const t0 = Date.now();
  const safe = makePreviewSafeSource(cut, { soft: false });
  const ms = Date.now() - t0;
  assert(ms < 2000, `heal must not hang (${ms}ms)`);
  assert(safe.truncated, "marked truncated");
  // either healed closed the string or used fallback — both ok
  assert(
    safe.usedFallback ||
      analyzeSourceTruncation(safe.code).stringState === "none",
    "no open string emitted"
  );
}

// ── soft vs hard fallback messaging ──────────────────────────────────────

{
  // Unhealable: almost empty garbage
  const junk = `function Component() {
  return (
    <div
`;
  const soft = makePreviewSafeSource(junk, { soft: true });
  const hard = makePreviewSafeSource(junk, { soft: false });
  if (soft.usedFallback) {
    assert(soft.code.includes("Building live preview"), "soft = Building shell");
  }
  if (hard.usedFallback) {
    assert(
      hard.code.includes("Generation cut off") ||
        hard.code.includes("Continue"),
      "hard = Continue card"
    );
  }
}

// ── Clean passthrough ────────────────────────────────────────────────────

{
  const ok = `function Component() {
  const plans = [{ name: "Free", price: 0 }];
  return <div>{plans.map((p) => p.price)}</div>;
}`;
  const r = makePreviewSafeSource(ok);
  assert(!r.truncated && !r.usedFallback, "clean passthrough");
  assert(r.code.includes("price: 0"), "object literal intact");
}

console.log("code-truncation tests: all passed");
