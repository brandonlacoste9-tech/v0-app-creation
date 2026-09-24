/**
 * Per-file structural validation + bare-return auto-repair suite.
 * Run: npx tsx src/lib/code-structure.test.ts
 */
import {
  checkFileStructure,
  detectBareObjectEntries,
  repairBareObjectEntries,
  repairBareReturn,
  repairProjectFiles,
  repairStrayJsxClosers,
  repairUnmatchedClosers,
  stripNonCode,
} from "./code-structure";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

// ── STRIP ────────────────────────────────────────────────────────────────

{
  const s = stripNonCode(`const a = "{ not a brace }"; // } comment\nconst b = 'hi';`);
  assert(!s.includes("not a brace"), "string content masked");
  assert(!s.includes("comment"), "comment masked");
  assert(s.includes("const a ="), "code kept");
  // newlines preserved
  assert(s.split("\n").length === 2, "newlines preserved");
}

{
  const s = stripNonCode("const t = `hello ${name}, { brace }`;");
  assert(!s.includes("brace"), "template literal masked");
  assert(s.includes("const t ="), "code kept");
}

// ── CLEAN FILES ──────────────────────────────────────────────────────────

{
  const src = `function ProductGrid() {
  const [count, setCount] = useState(0);
  return (
    <div className="grid">
      {PRODUCTS.map((p) => (
        <div key={p.sku}>{p.name}</div>
      ))}
    </div>
  );
}`;
  assert(checkFileStructure("src/ProductGrid.tsx", src).length === 0, "clean component passes");
}

{
  // object method with return must not flag
  const src = `const helpers = {
  format(p) {
    return "$" + p.price;
  },
};`;
  assert(checkFileStructure("src/lib.ts", src).length === 0, "object method return ok");
}

{
  // arrow function with return must not flag
  const src = `const double = (x) => {
  return x * 2;
};
export default function App() {
  if (true) {
    return null;
  }
  return <div>{double(2)}</div>;
}`;
  assert(checkFileStructure("src/App.tsx", src).length === 0, "arrow + nested return ok");
}

{
  // braces inside strings/comments must not unbalance
  const src = `function C() {
  const s = "}{";
  // }{
  /* }{ */
  return <div>{s}</div>;
}`;
  assert(checkFileStructure("src/C.tsx", src).length === 0, "string/comment braces ignored");
}

// ── FAILURE MODES ────────────────────────────────────────────────────────

{
  // The observed ProductGrid.tsx failure: bare top-level return
  const src = `return (
  <div className="grid">
    {PRODUCTS.map((p) => <div key={p.sku}>{p.name}</div>)}
  </div>
);`;
  const issues = checkFileStructure("src/ProductGrid.tsx", src);
  assert(
    issues.some((i) => i.message.includes("Top-level 'return'")),
    "bare top-level return flagged"
  );
}

{
  const src = `function C() {
  const x = { a: 1 };
  return <div>;`;
  const issues = checkFileStructure("src/C.tsx", src);
  assert(issues.some((i) => i.message.includes("Unclosed")), "unclosed brace flagged");
}

{
  const src = `function C() {
  return <div>;
}}`;
  const issues = checkFileStructure("src/C.tsx", src);
  assert(issues.some((i) => i.message.includes("Unmatched")), "stray closer flagged");
}

{
  const src = `const x = await fetch("/api");`;
  const issues = checkFileStructure("src/C.tsx", src);
  assert(
    issues.some((i) => i.message.includes("Top-level 'await'")),
    "top-level await flagged"
  );
}

{
  const src = `function C() {
  return <div className="x">`;
  const issues = checkFileStructure("src/C.tsx", src);
  assert(issues.length > 0, "truncated file flagged");
}

// ── REPAIR ───────────────────────────────────────────────────────────────

{
  const src = `return (
  <div className="grid">
    {PRODUCTS.map((p) => <div key={p.sku}>{p.name}</div>)}
  </div>
);`;
  const fixed = repairBareReturn("src/ProductGrid.tsx", src);
  assert(fixed != null, "bare return repaired");
  assert(fixed!.startsWith("function ProductGrid() {"), "wrapped in named function");
  assert(
    checkFileStructure("src/ProductGrid.tsx", fixed!).length === 0,
    "repaired file is structurally clean"
  );
}

{
  // does not repair when braces are unbalanced
  const src = `return (
  <div>`;
  assert(
    repairBareReturn("src/Bad.tsx", src) == null,
    "no repair when unbalanced"
  );
}

{
  // does not repair when a component is already declared
  const src = `function Existing() {
  return <div>hi</div>;
}`;
  assert(
    repairBareReturn("src/Existing.tsx", src) == null,
    "no repair when function exists"
  );
}

{
  // lowercase file base is not a component — no repair
  const src = `return 42;`;
  assert(
    repairBareReturn("src/util.ts", src) == null,
    "no repair for non-component file"
  );
}

{
  const { files, repaired } = repairProjectFiles({
    "src/ProductGrid.tsx": `return <div>grid</div>;`,
    "src/Component.tsx": `function Component() {\n  return <div>ok</div>;\n}`,
  });
  assert(repaired.includes("src/ProductGrid.tsx"), "repair reported");
  assert(
    files["src/ProductGrid.tsx"]!.includes("function ProductGrid()"),
    "repaired content stored"
  );
  assert(
    files["src/Component.tsx"]!.startsWith("function Component()"),
    "clean file untouched"
  );
}

// ── BARE OBJECT ENTRIES (fragment without wrapper) ──────────────────────

const FRAGMENT_SRC = `import React from "react";

knive: <svg viewBox="0 0 96 96" className="w-full h-full"><path d="M18 78 L78 18" stroke="#E5D9C8" strokeWidth="2"/></svg>,
board: <svg viewBox="0 0 96 96" className="w-full h-full"><rect x="14" y="14" width="68" height="68" fill="none" stroke="#E5D9C8"/></svg>,

function Component() {
  return (
    <div>
      <div>{assets.knive}</div>
      <div>{assets["board"]}</div>
    </div>
  );
}
export default Component;
`;

{
  const runs = detectBareObjectEntries("src/Component.tsx", FRAGMENT_SRC);
  assert(runs.length === 1, "one run detected");
  assert(runs[0].startLine === 3 && runs[0].endLine === 4, "correct lines");
  assert(
    runs[0].keys.join(",") === "knive,board",
    "keys extracted: " + runs[0].keys.join(",")
  );
}

{
  // Repair wraps with the referenced identifier; result must be clean
  const r = repairBareObjectEntries("src/Component.tsx", FRAGMENT_SRC);
  assert(r.repaired, "fragment repaired");
  assert(
    r.src.includes("const assets = {"),
    "wrapped as const assets, got:\n" + r.src.split("\n").slice(0, 6).join("\n")
  );
  assert(
    checkFileStructure("src/Component.tsx", r.src).length === 0,
    "repaired source is structurally clean"
  );
}

{
  // Orphaned closing brace after the fragment is consumed, not left stray
  const src = `knive: <svg viewBox="0 0 1 1"></svg>,
board: <svg viewBox="0 0 1 1"></svg>,
};
function Component() {
  return <div>{assets.knive}{assets.board}</div>;
}
`;
  const r = repairBareObjectEntries("src/Component.tsx", src);
  assert(r.repaired, "fragment with orphan closer repaired");
  const problems = checkFileStructure("src/Component.tsx", r.src);
  assert(
    problems.length === 0,
    "no leftover unmatched brace: " + JSON.stringify(problems)
  );
}

{
  // Hyphenated keys via bracket access
  const src = `canvas-tote: <svg viewBox="0 0 1 1"></svg>,
field-notebook: <svg viewBox="0 0 1 1"></svg>,
function Component() {
  return <div>{imgs["canvas-tote"]}{imgs["field-notebook"]}</div>;
}
`;
  const r = repairBareObjectEntries("src/Component.tsx", src);
  assert(r.repaired && r.src.includes("const imgs = {"), "bracket-access repair");
  assert(
    checkFileStructure("src/Component.tsx", r.src).length === 0,
    "hyphenated repair is clean"
  );
}

{
  // No reference anywhere: repair declines, structure check names it
  const src = `knive: <svg viewBox="0 0 1 1"></svg>,
board: <svg viewBox="0 0 1 1"></svg>,
function Component() {
  return <div>no references here</div>;
}
`;
  const r = repairBareObjectEntries("src/Component.tsx", src);
  assert(!r.repaired, "unreferenced fragment not repaired");
  const problems = checkFileStructure("src/Component.tsx", src);
  assert(
    problems.some((p) => p.message.includes("object entries")),
    "named bare_object_entries error: " + JSON.stringify(problems)
  );
}

{
  // No false positives on healthy code
  const healthy = `import React from "react";
const assets: Record<string, React.ReactNode> = {
  knive: <svg viewBox="0 0 1 1"></svg>,
  board: <svg viewBox="0 0 1 1"></svg>,
};
function Component() {
  const note: string = "knive: not an entry";
  return <div>{assets.knive}<span>Note: text with colon</span></div>;
}
export default Component;
`;
  assert(
    detectBareObjectEntries("src/Component.tsx", healthy).length === 0,
    "healthy file: no runs"
  );
  assert(
    checkFileStructure("src/Component.tsx", healthy).length === 0,
    "healthy file: no issues"
  );
  const r = repairBareObjectEntries("src/Component.tsx", healthy);
  assert(!r.repaired && r.src === healthy, "healthy file untouched");
}

{
  // repairProjectFiles picks up the fragment alongside bare-return files
  const { files, repaired } = repairProjectFiles({
    "src/Component.tsx": FRAGMENT_SRC,
    "src/Clean.tsx": `export function Clean() {\n  return <div>ok</div>;\n}`,
  });
  assert(repaired.includes("src/Component.tsx"), "fragment repair reported");
  assert(!repaired.includes("src/Clean.tsx"), "clean file not flagged");
  assert(
    files["src/Component.tsx"]!.includes("const assets = {"),
    "fragment wrapped in project repair"
  );
}

// ── UNMATCHED CLOSER REPAIR (probe 2026-09-23) ─────────────────────────
// The model emitted a stray `)` at line 73 ("Unmatched ')' — no opening '('").
// Count-based checks missed it (totals balanced), but Babel failed on everything
// after it — a valid `const ICONS = { beanie: <svg/> }` at line 146 reported
// "Unexpected token" as a cascade. repairUnmatchedClosers drops the stray.

{
  const src = `function Header() {
  return <header>Shop</header>;
}
function ProductGrid() {
  const items = [1, 2, 3];
  return <div>{items.length}</div>;
}
)
const ICONS = {
  beanie: <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>,
  tote: <svg viewBox="0 0 24 24"><rect width="10" height="10" /></svg>,
};
function Component() {
  return <main><Header /><ProductGrid /></main>;
}`;
  // checkFileStructure flags it
  const issues = checkFileStructure("src/Component.tsx", src);
  assert(
    issues.some((i) => i.message.includes("Unmatched ')'")),
    "stray ) flagged by checkFileStructure"
  );
  // repair removes it
  const r = repairUnmatchedClosers("src/Component.tsx", src);
  assert(r.repaired, "stray ) repaired");
  assert(r.note!.includes("line"), "note names the line");
  const issuesAfter = checkFileStructure("src/Component.tsx", r.src);
  assert(
    !issuesAfter.some((i) => i.message.includes("Unmatched")),
    "no unmatched closers after repair"
  );
  assert(r.src.includes("const ICONS = {"), "ICONS object survives");
  assert(r.src.includes("beanie:"), "beanie key survives");
}

{
  // Valid code is untouched (including regex with parens, templates, strings)
  const src = `function Component() {
  const re = /foo(bar)/;
  const msg = \`count: \${items.length} (done)\`;
  const s = "a)b(c";
  // ) comment with paren
  /* ] bracket in comment */
  return <div>{msg}</div>;
}`;
  const r = repairUnmatchedClosers("src/Component.tsx", src);
  assert(!r.repaired, "valid code untouched");
  assert(r.src === src, "valid source identical");
}

{
  // repairProjectFiles picks up the stray closer
  const { files, repaired } = repairProjectFiles({
    "src/Component.tsx": `function Component() {\n  return <div>ok</div>;\n}\n)`,
  });
  assert(repaired.includes("src/Component.tsx"), "stray closer repaired in project");
  assert(!files["src/Component.tsx"]!.trimEnd().endsWith(")"), "trailing ) removed");
}

console.log("code-structure tests: all passed");

// ── STRAY JSX CLOSER REPAIR (probe 2026-09-24) ──────────────────────────
// The model emitted `</ProductDetail></Header>` after a self-closed
// `<ProductDetail ... />`. Babel failed with "Expected corresponding JSX
// closing tag" and the preview stayed blank. repairStrayJsxClosers drops
// closers that provably have no opener.

{
  // Stray closer after a self-closed component of the same name, plus a
  // closer with no opener at all anywhere in the file.
  const src = `function Component() {
  return (
    <div className="wrap">
      <ProductDetail name="Harbor Cap" price={32} />
    </div>
    </ProductDetail></Header>
  );
}`;
  const r = repairStrayJsxClosers("src/Component.tsx", src);
  assert(r.repaired, "stray JSX closers repaired");
  assert(r.note!.includes("line"), "note names the line");
  assert(!r.src.includes("</ProductDetail>"), "</ProductDetail> removed");
  assert(!r.src.includes("</Header>"), "</Header> removed");
  assert(
    r.src.includes('<ProductDetail name="Harbor Cap" price={32} />'),
    "self-closed tag kept"
  );
  assert(r.src.includes("</div>"), "legitimate closer kept");
}

{
  // Stray closer with no opener at all.
  const src = `function Component() {
  return <main><h1>Hi</h1></main></Footer>;
}`;
  const r = repairStrayJsxClosers("src/Component.tsx", src);
  assert(r.repaired, "opener-less closer repaired");
  assert(!r.src.includes("</Footer>"), "</Footer> removed");
  assert(
    r.src.includes("<main><h1>Hi</h1></main>"),
    "matched pairs untouched"
  );
}

{
  // Valid JSX is untouched: nested pairs, fragments, self-closing tags,
  // member-expression components, and `<` in code (comparisons, generics).
  const src = `function Component({ items }: { items: number[] }) {
  const big = items.filter((x) => x > 2);
  const cmp = items.length < 3 && big.length > 0;
  return (
    <>
      <div className="a" data-n={items.length < 3 ? 1 : 2}>
        <Header title="a < b" />
        <Foo.Bar>x</Foo.Bar>
        {big.length > 0 && <span>many</span>}
      </div>
    </>
  );
}`;
  const r = repairStrayJsxClosers("src/Component.tsx", src);
  assert(!r.repaired, "valid JSX untouched");
  assert(r.src === src, "valid source identical");
}

{
  // Misnested closer (opener exists but isn't on top) is left alone —
  // removing it would be guessing at the model's intent.
  const src = `function C() {
  return <div><span>x</div></span>;
}`;
  const r = repairStrayJsxClosers("src/Component.tsx", src);
  assert(!r.repaired, "misnested closer left alone");
  assert(r.src === src, "misnested source identical");
}

{
  // repairProjectFiles picks up the stray JSX closers (generation path).
  const { files, repaired } = repairProjectFiles({
    "src/Component.tsx":
      "function C() {\n  return <div><ProductDetail name=\"x\" /></div></ProductDetail>;\n}",
  });
  assert(
    repaired.includes("src/Component.tsx"),
    "stray JSX closer repaired in project"
  );
  assert(
    !files["src/Component.tsx"]!.includes("</ProductDetail>"),
    "stray closer gone from project file"
  );
}
