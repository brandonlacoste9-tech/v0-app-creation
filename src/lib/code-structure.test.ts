/**
 * Per-file structural validation + bare-return auto-repair suite.
 * Run: npx tsx src/lib/code-structure.test.ts
 */
import {
  checkFileStructure,
  repairBareReturn,
  repairProjectFiles,
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

console.log("code-structure tests: all passed");
