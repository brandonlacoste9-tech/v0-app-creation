/**
 * Truncation state machine + JSX rebalance suite.
 * Run: npx tsx src/lib/code-truncation.test.ts
 */
import {
  analyzeSourceTruncation,
  bareJsxKeyRewriteMiss,
  countUnclosedJsxOpeners,
  countUnmatchedJsxClosers,
  healTruncatedSource,
  isHealedSourceViable,
  looksLikeTruncationCompileError,
  makePreviewSafeSource,
  repairJsxTagBalance,
  rewriteBareJsxObjectEntries,
  sealPreviewFragment,
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
      hard.code.includes("token limit") ||
        hard.code.includes("Continue with current context") ||
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

{
  const news = `function Newsletter() {
  const [message, setMessage] = useState('');
  return (
    <form>
      <input value={message} onChange={(e) => setMessage(e.target.value)} />
    </form>
  );
}`;
  const sealed = sealPreviewFragment(news);
  assert(sealed.includes("function Newsletter"), "keeps function wrapper");
  assert(
    /function Newsletter\(\) \{[\s\S]*return \(/.test(sealed),
    "return stays inside Newsletter"
  );
  const dangling = sealPreviewFragment(
    `.formatMoney ? (window as any).formatMoney : String;\nfunction ProductGrid() { return <p>ok</p>; }`
  );
  assert(dangling.includes("function ProductGrid"), "keeps ProductGrid");
  assert(!dangling.trimStart().startsWith("."), "drops leftover .formatMoney tail");
}

{
  const naked = `'canvas-tote': <svg viewBox="0 0 96 96" className="w-full h-full"><rect /></svg>`;
  assert(bareJsxKeyRewriteMiss(naked) === null, "paren depth 0 is not a miss — rewrite handles it");
  assert(rewriteBareJsxObjectEntries(naked).includes("var __icon_canvas_tote"), "naked key rewrites");
  const blocked = `function Icons(\n'canvas-tote': <svg viewBox="0 0 96 96" className="w-full h-full"><rect /></svg>\n`;
  const miss = bareJsxKeyRewriteMiss(blocked);
  assert(Boolean(miss && miss.includes("function Icons(") && miss.includes("'canvas-tote':")), "open paren keeps the pre-rewrite fragment");
  assert(
    rewriteBareJsxObjectEntries(blocked).includes("'canvas-tote':"),
    "rewrite still refuses while a ( above the key is open"
  );
  const objectLiteral = `const ICONS = {\n  'canvas-tote': <svg viewBox="0 0 80 100"></svg>,\n};\n`;
  assert(bareJsxKeyRewriteMiss(objectLiteral) === null, "real icon object is not a miss");
}

// ── looksLikeTruncationCompileError ───────────────────────────────────────
// Deterministic message matching only: truncation signatures nudge Continue,
// healable structural errors must NOT match.

{
  // Truncation signatures → nudge
  assert(
    looksLikeTruncationCompileError("Unexpected end of input (1:2345) — preview did not compile. Ready-to-ship cannot pass."),
    "unexpected end of input matches"
  );
  assert(
    looksLikeTruncationCompileError("Unterminated string constant (12:40)"),
    "unterminated string matches"
  );
  assert(
    looksLikeTruncationCompileError("Unterminated template (3:1)"),
    "unterminated template matches"
  );
  assert(
    looksLikeTruncationCompileError("Missing semicolon. (1:10) — generation often cut off at the token limit. In chat: …"),
    "iframe token-limit hint matches"
  );
  assert(
    !looksLikeTruncationCompileError("Unexpected token '}' – expected end of input"),
    "generic unexpected-token phrasing does not match"
  );
  assert(
    !looksLikeTruncationCompileError(""),
    "empty message never matches"
  );

  // Structural / environmental errors → no nudge (sanitizer or other flow owns these)
  assert(
    !looksLikeTruncationCompileError("Expected corresponding JSX closing tag for <div> (321:4) — preview did not compile. Ready-to-ship cannot pass."),
    "stray JSX closer does not match"
  );
  assert(
    !looksLikeTruncationCompileError("Unexpected token, expected \",\" (10:5)"),
    "bare unexpected token does not match (legacy atelier case nudges via code analysis instead)"
  );
  assert(
    !looksLikeTruncationCompileError("Missing semicolon. (1:10)"),
    "bare missing semicolon does not match — not exclusive to truncation"
  );
  assert(
    !looksLikeTruncationCompileError("Component is not defined — missing component (often a broken multi-file merge or icon import)."),
    "not-defined does not match"
  );
  assert(
    !looksLikeTruncationCompileError("A CDN asset failed to load (network or blocked)."),
    "CDN failure does not match"
  );
}

// ── Unclosed JSX opening tag (truncated mid-nesting) ─────────────────────
// Regression: a generation cut off mid-nesting leaves an open <div> with no
// closer. Brace/paren balance is unaffected, so this class must be caught by
// the JSX-opener walk, not the brace scanner. Babel rejects it with
// "Expected corresponding JSX closing tag for <div>" / "Unterminated JSX
// contents", but it previously validated as complete and fired a false
// "Build complete" toast on Continue.

{
  const cut = `function Component() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-5xl font-bold">Harbor Goods</h1>
      <div className="grid grid-cols-3">
        <div className="p-4">
          <h2>Canvas Tote</h2>
          <p>$42</p>
      </div>
    </div>
  );
}
`;
  assert(countUnclosedJsxOpeners(cut) === 1, "one unclosed JSX opener detected");
  const a = analyzeSourceTruncation(cut);
  assert(a.likelyTruncated, "unclosed opener flagged truncated");
  assert(
    a.reasons.some((r) => /unclosed JSX tag/.test(r)),
    "reason names the unclosed JSX tag: " + JSON.stringify(a.reasons)
  );
}

{
  // Healthy code must NOT false-positive — TypeScript generics, comparisons,
  // void elements, self-closing tags, and fragments are all fine.
  const healthy = `function Component({ items }: { items: number[] }) {
  const [n, setN] = React.useState<number>(0);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const rec: Record<string, unknown> = {};
  const big = items.length < 3 && n > 0;
  const els = items.map<React.ReactNode>((i) => <li key={i}>{i}</li>);
  return (
    <>
      <img src="x" alt="" />
      <input type="text" />
      <br />
      <div className="wrap">{big ? els : "none"}</div>
    </>
  );
}`;
  assert(countUnclosedJsxOpeners(healthy) === 0, "healthy TSX has no unclosed openers");
  assert(!analyzeSourceTruncation(healthy).likelyTruncated, "healthy TSX not truncated");
}

console.log("code-truncation tests: all passed");
