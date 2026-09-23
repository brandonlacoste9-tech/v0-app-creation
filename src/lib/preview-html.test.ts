/**
 * Run: npx tsx src/lib/preview-html.test.ts
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { sanitizePreviewSource, wrapCodeForPreview, rewriteBareJsxObjectEntries } from "./preview-html";
import {
  applyCatalogPreviewIntercept,
  isStructurallySoundTsx,
  stripPlatformCatalogDeclarations,
} from "./commerce/preview";
import {
  analyzeSourceTruncation,
  makePreviewSafeSource,
} from "./code-truncation";
import { PREVIEW_THEMES } from "./types";
import { mergeForPreview, scopePreviewScript, serializeProject } from "./project-files";
import { parse } from "@babel/parser";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

const theme = PREVIEW_THEMES[0];

// strip types
{
  const raw = `function Component() {
  const [n, setN]: [number, any] = useState(0 as number);
  const x: string = "hi";
  return <div className="p-4">{n}{x}</div>;
}`;
  const s = sanitizePreviewSource(raw);
  assert(!s.includes(": [number"), "strip tuple annotation");
  assert(!s.includes("as number"), "strip as cast");
  assert(s.includes("useState(0)"), "keep useState");
}

// strip destructured props + call generics (main red-code source)
{
  const raw = `interface Props { title: string }
function Component({ title }: Props) {
  const [n, setN] = useState<number>(0);
  const ref = useRef<HTMLDivElement | null>(null);
  return <div className="p-4" onClick={() => setN(n + 1)}>{title}{n}</div>;
}`;
  const s = sanitizePreviewSource(raw);
  assert(!s.includes("interface Props"), "strip interface");
  assert(!s.includes(": Props"), "strip destructure type");
  assert(!s.includes("useState<number>"), "strip useState generic");
  assert(!s.includes("useRef<HTMLDivElement"), "strip useRef generic");
  assert(s.includes("useState(0)"), "keep useState call");
  assert(s.includes("function Component({ title })"), "keep destructure params");
  assert(s.includes("className="), "keep JSX");
}

// strip React.FC annotation
{
  const raw = `const Component: React.FC<{ name: string }> = ({ name }) => {
  return <div>{name}</div>;
}`;
  const s = sanitizePreviewSource(raw);
  assert(!s.includes("React.FC"), "strip React.FC");
  assert(s.includes("const Component ="), "keep const Component");
}

// English "as" inside strings must NOT be stripped (broke all marketing templates)
{
  const raw = `function Component() {
  const features = [
    { t: "Live preview", d: "Watch the UI assemble as the model streams." },
  ];
  const n = 0 as number;
  return <div>{features[0].d}{n}</div>;
}`;
  const s = sanitizePreviewSource(raw);
  assert(
    s.includes("assemble as the model streams"),
    "keep English as inside string"
  );
  assert(s.includes("0") && !s.includes("as number"), "still strip as number");
  assert(!analyzeSourceTruncation(s).likelyTruncated, "must not corrupt strings");
}

// Apostrophes + English "private" (templates: You're / private beta)
{
  const raw = `function Component() {
  return (
    <div>
      <p>You're in. We'll email you.</p>
      <p>Join the private beta.</p>
    </div>
  );
}`;
  const s = sanitizePreviewSource(raw);
  assert(s.includes("You're in"), "keep You're");
  assert(s.includes("We'll email"), "keep We'll");
  assert(s.includes("private beta"), "keep private beta");
  assert(!analyzeSourceTruncation(s).likelyTruncated, "apostrophes not trunc");
  const safe = makePreviewSafeSource(s);
  assert(!safe.usedFallback, "no fallback for clean template");
}

// object literals: price/role must stay (not become shorthand → ReferenceError)
{
  const raw = `function Component() {
  const plans = [
    { name: "Free", price: 0, features: ["A"] },
    { name: "Pro", price: 25 },
  ];
  const users = [
    { name: "Ada", role: "admin" },
    { name: "Lin", role: "member" },
    { name: "Root", role: Admin },
  ];
  return (
    <div>
      {plans.map((p) => p.price)}
      {users.map((u) => u.role)}
    </div>
  );
}`;
  const s = sanitizePreviewSource(raw);
  assert(s.includes("price: 0"), "keep price: 0");
  assert(s.includes("price: 25"), "keep price: 25");
  assert(s.includes('role: "admin"'), "keep role string");
  assert(s.includes("role: Admin"), "keep role: Admin value even if capitalized");
  assert(!/\bprice\s*,/.test(s), "no price shorthand");
  assert(!/\brole\s*,/.test(s), "no role shorthand");
  // still strip real param types
  const typed = sanitizePreviewSource(
    `function Component() {
  const go = (e: React.MouseEvent, n: number) => n;
  const Badge = (role: string) => <span>{role}</span>;
  return <button onClick={go}><Badge role="x" /></button>;
}`
  );
  assert(!typed.includes("React.MouseEvent"), "still strip event types");
  assert(!typed.includes("n: number"), "still strip number params");
  assert(
    typed.includes("(role)") || typed.includes("(role )"),
    "strip role: string param"
  );
}

// computed form keys: [name]: type === 'checkbox' must NOT become [name]===
{
  const raw = `function Component() {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  return <input onChange={handleChange} />;
}`;
  const s = sanitizePreviewSource(raw);
  assert(!s.includes("[name]==="), "must not glue [name]=== after stripping");
  assert(/\[name\]\s*:/.test(s), "keep computed key colon");
  assert(s.includes("type ==="), "keep type === comparison");
  assert(!s.includes("React.ChangeEvent"), "still strip event param type");
  // real destructured param types still strip
  const dest = sanitizePreviewSource(
    `function Component({ title }: Props) {
  const go = ([a, b]: [number, string]) => a;
  return <div>{title}{go([1,"x"])}</div>;
}`
  );
  assert(!dest.includes(": Props"), "strip ({ title }: Props)");
  assert(!dest.includes("[number, string]"), "strip tuple param type");
}

// wrap includes babel transform path
{
  const html = wrapCodeForPreview(
    `function Component() {
  return <div className="min-h-screen bg-zinc-950 text-white p-8"><h1>OK</h1></div>;
}`,
    theme
  );
  assert(html.includes("Babel.transform"), "uses Babel.transform");
  assert(html.includes("adgen-error"), "error panel");
  assert(html.includes("createRoot"), "createRoot");
}

// multi-file
{
  const multi = serializeProject(
    {
      "src/Hero.tsx": `function Hero() {
  return <h1 className="text-3xl font-bold text-white">Hero</h1>;
}`,
      "src/Component.tsx": `function Component() {
  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <Hero />
    </div>
  );
}`,
    },
    "src/Component.tsx"
  );
  const html = wrapCodeForPreview(multi, theme);
  assert(html.includes("function Hero"), "merged Hero");
  assert(html.includes("function Component"), "merged Component");
}

// heal truncated className — preview must still wrap a compilable Component
{
  const broken = `function Component() {
  return (
    <div className="min-h-screen">
      <a href="#how" className="py-1
`;
  assert(analyzeSourceTruncation(broken).likelyTruncated, "detect trunc");
  const safe = makePreviewSafeSource(broken);
  assert(safe.truncated, "marked truncated");
  assert(/function\s+Component/.test(safe.code), "has Component");
  const html = wrapCodeForPreview(broken, theme);
  assert(html.includes("Babel.transform"), "still wraps");
  assert(html.includes("function Component") || html.includes("Component"), "embeds component");
}

// Agent-ready store: PRODUCTS used without import must still be injected
{
  const raw = `function Component() {
  return <main><h1>{PRODUCTS[0].title}</h1></main>;
}`;
  const html = wrapCodeForPreview(raw, theme);
  assert(html.includes("var PRODUCTS"), "injects PRODUCTS for preview");
  assert(html.includes("Field notebook") || html.includes("NL-NB-01"), "injects catalog data");
}

// Probe: catalog.ts AND Component both declare PRODUCTS — must be one binding
{
  const dup = serializeProject(
    {
      "src/lib/catalog.ts": `export const CATALOG = { products: [{ sku: "X", title: "Fake" }] };
export const PRODUCTS = CATALOG.products;
export function getProduct(id) { return PRODUCTS[0]; }
export function formatMoney(c) { return String(c); }
`,
      "src/Component.tsx": `const PRODUCTS = CATALOG.products;
function Component() {
  return <main><h1>{PRODUCTS[0].title}</h1></main>;
}
`,
    },
    "src/Component.tsx"
  );
  const html = wrapCodeForPreview(dup, theme);
  assert(html.includes("var PRODUCTS"), "injects platform PRODUCTS");
  const userDecls = (html.match(/const PRODUCTS = CATALOG\.products/g) || []).length;
  assert(userDecls === 0, "strips Component const PRODUCTS redeclare");
  assert(!html.includes("sku: \"X\""), "drops model's catalog file from iframe merge");
  assert(html.includes("NL-NB-01") || html.includes("Field notebook"), "platform catalog SKUs");
}

// Attached ACP route must not leak into the iframe script
{
  const withAcp = serializeProject(
    {
      "src/Component.tsx": `function Component() {
  return <main><h1>{PRODUCTS[0].title}</h1></main>;
}
`,
      "app/api/acp/checkout-sessions/route.ts": `const items = (Array.isArray(body.line_items) ? body.line_items : [body]);
export async function POST() { return items; }
`,
    },
    "src/Component.tsx"
  );
  const html = wrapCodeForPreview(withAcp, theme);
  assert(!html.includes("line_items"), "eject ACP stays out of preview");
  assert(!html.includes("line_ite"), "no truncated line_items");
  assert(html.includes("var PRODUCTS"), "catalog still injected");
}

// window.formatMoney — wizard ProductGrid calls (window as any).formatMoney
{
  const raw = `function ProductGrid() {
  const label = (window as any).formatMoney(1800, "usd");
  return <p>{label}</p>;
}
function Component() {
  return <main>{PRODUCTS.map((p) => <ProductGrid key={p.sku} />)}</main>;
}
`;
  const html = wrapCodeForPreview(raw, theme);
  assert(html.includes("w.formatMoney") || html.includes("window.formatMoney"), "iframe window.formatMoney");
  assert(html.includes("window.PRODUCTS") || html.includes("w.PRODUCTS"), "PRODUCTS also on window");
}

// Atelier: truncated (window as any).formatMoney at a file boundary must not poison ProductGrid
{
  const atelier = serializeProject(
    {
      "src/Header.tsx": `function Header() {
  const label = (window as any)
.formatMoney ? (window as any).formatMoney(100, "usd") : "";
  return <header>{label}</header>;
}
`,
      "src/ProductGrid.tsx": `function ProductGrid() {
  return <section className="store-contrast">{PRODUCTS[0].title}</section>;
}
`,
      "src/Component.tsx": `const PRODUCTS: { sku: string; title: string }[] = [{ sku: "A", title: "Tote" }];
function Component() {
  return <main><Header /><ProductGrid /></main>;
}
`,
    },
    "src/Component.tsx"
  );
  const html = wrapCodeForPreview(atelier, theme);
  assert(html.includes("function ProductGrid"), "ProductGrid still in preview");
  assert(!html.includes("Unexpected token") || html.includes("ProductGrid"), "compiles or keeps UI");
  const userDecls = (html.match(/const PRODUCTS/g) || []).length;
  assert(userDecls === 0, "strips typed const PRODUCTS from Component");
  assert(html.includes("var PRODUCTS"), "platform PRODUCTS injected");
  assert(html.includes("Tote"), "merchant SKU survives typed PRODUCTS");
  assert(!html.includes("Camp blanket"), "no Northline fallback catalog");
}

{
  const rewritten = rewriteBareJsxObjectEntries(`function ProductGrid() {
  return <section>ok</section>;
}
"canvas-tote": <svg viewBox="0 0 80 100"></svg>
function Component() { return <ProductGrid />; }
`);
  assert(rewritten.includes("var __icon_canvas_tote ="), "rewrites bare object entry");
  assert(!/^["']canvas-tote["']\s*:/m.test(rewritten), "no bare canvas-tote key");
  const html = wrapCodeForPreview(rewritten, theme);
  assert(html.includes("ProductGrid") || html.includes("__icon_canvas_tote"), "preview keeps the grid");
}

{
  const insideFn = rewriteBareJsxObjectEntries(`function ProductGrid() {
  const PRODUCTS = [];
  'canvas-tote': <svg viewBox="0 0 80 100"></svg>
  return <section className="store-contrast">ok</section>;
}`);
  assert(insideFn.includes("var __icon_canvas_tote ="), "rewrites hyphenated key inside function body");
}

{
  const obj = rewriteBareJsxObjectEntries(`function ProductGrid() {
  const ICONS = {
    'canvas-tote': <svg viewBox="0 0 80 100"></svg>
  };
  return <div>{ICONS}</div>;
}`);
  assert(obj.includes("'canvas-tote':"), "keeps real object-literal icon map");
}

{
  const jsx = rewriteBareJsxObjectEntries(`function ProductGrid() {
  return (
    <div>
      'canvas-tote': <svg viewBox="0 0 80 100"></svg>
    </div>
  );
}`);
  assert(jsx.includes("'canvas-tote':"), "does not rewrite inside JSX (v3 closing-tag bug)");
}

{
  const street = serializeProject(
    {
      "src/Header.tsx": `function Header() {
  const open = { leftover:
`,
      "src/ProductGrid.tsx": `function ProductGrid() {
  'canvas-tote': <svg viewBox="0 0 80 100"></svg>
  return <section>grid</section>;
}
`,
      "src/Component.tsx": `function Component() {
  return <main><Header /><ProductGrid /></main>;
}
`,
    },
    "src/Component.tsx"
  );
  const html = wrapCodeForPreview(street, theme);
  assert(html.includes("var __icon_canvas_tote") || html.includes("function ProductGrid"), "per-file rewrite survives unclosed brace in Header");
  assert(!html.includes("'canvas-tote': <svg") && !html.includes('"canvas-tote": <svg'), "no bare canvas-tote in preview source");
}

{
  const street = `function Header() {
  return <header className="sticky top-0">Mark</header>;
}
function ProductGrid() {
  const PRODUCTS = [{ sku: "canvas-tote", title: "Canvas tote", price: 4200 }];
  'canvas-tote': <svg viewBox="0 0 96 96"><rect width="10" height="10" /></svg>
  return <section className="store-contrast">grid</section>;
}
function Component() {
  return <main><Header /><ProductGrid /></main>;
}
`;
  const cleaned = sanitizePreviewSource(street);
  assert(cleaned.includes("var __icon_canvas_tote ="), "wizard sanitize rewrites the bare key");
  assert(!/["']canvas-tote["']\s*:/.test(cleaned), "no bare key left for Babel");
  parse(cleaned, { sourceType: "script", plugins: ["jsx"] });

  const wrapped = wrapCodeForPreview(
    serializeProject(
      {
        "src/Header.tsx": `function Header() {
  return <header className="sticky top-0">Mark</header>;
}
`,
        "src/ProductGrid.tsx": `function ProductGrid() {
  'canvas-tote': (
    <svg viewBox="0 0 96 96"><rect width="8" height="8" /></svg>
  );
  return <section className="store-contrast">grid</section>;
}
`,
        "src/Component.tsx": `function Component() {
  return <main><Header /><ProductGrid /></main>;
}
`,
      },
      "src/Component.tsx"
    ),
    theme
  );
  const embedded = wrapped.match(/var source = ("(?:\\.|[^"\\])*");/);
  assert(Boolean(embedded), "preview html embeds source");
  const parsedSource = JSON.parse(embedded![1]) as string;
  assert(parsedSource.includes("var __icon_canvas_tote ="), "per-file rewrite is on the wizard preview path");
  parse(parsedSource, { sourceType: "script", plugins: ["jsx"] });

  const inside = `function ProductGrid() {
  return (
    <div>
      <span>ok</span>
    </div>
  );
}`;
  assert(!rewriteBareJsxObjectEntries(inside).includes("__icon_"), "closed JSX is not rewritten");
  parse(sanitizePreviewSource(inside), { sourceType: "script", plugins: ["jsx"] });
}

{
  const html = wrapCodeForPreview(
    `function Component() { return <main><h1>Ok</h1></main>; }`,
    theme
  );
  assert(html.includes("__adgenRecordRuntime"), "preview records runtime errors");
  assert(html.includes("componentStack"), "preview keeps the React component stack");
  assert(html.includes("__adgenRuntimeErrors"), "live QA can read structured errors");
}

// Preview crash 2026-09-22: a Street Harbor Goods probe failed to compile —
// "Preview blocked — preview did not compile" with a Babel syntax error at the
// injected `var CATALOG = …` statement. Root cause: stripPlatformCatalogDeclarations
// removed `function formatMoney(cents: number)` but left the TS return type
// behind as a stray `: string { … }` at the top level. The intercept must never
// emit unparseable code (fails BEFORE the fix: Babel "Unexpected token").
{
  const streetHarborGoods = `import { useState } from "react";

type Product = { id: string; sku: string; title: string; price: number; currency: string };

function formatMoney(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

const PRODUCTS: Product[] = [
  { id: "canvas-tote", sku: "HG-TOTE-001", title: "Canvas Tote", price: 4200, currency: "usd" },
  { id: "field-notebook", sku: "HG-NOTE-002", title: "Field Notebook", price: 1800, currency: "usd" },
  { id: "steel-bottle", sku: "HG-BOTL-003", title: "Steel Bottle", price: 3400, currency: "usd" },
];

function Newsletter() {
  const [email, setEmail] = useState("");
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="nl-email">Email</label>
      <input id="nl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
    </form>
  );
}

export default function Component() {
  return (
    <main>
      <h1>Harbor Goods</h1>
      {PRODUCTS.map((p) => (
        <article key={p.sku}>
          <h3>{p.title}</h3>
          <p>{formatMoney(p.price)}</p>
        </article>
      ))}
      <Newsletter />
    </main>
  );
}
`;
  const stripped = stripPlatformCatalogDeclarations(streetHarborGoods);
  assert(!/:[ \t]*string[ \t]*\{/.test(stripped), "strip consumes the `: string` return type");
  assert(!stripped.includes("function formatMoney"), "formatMoney declaration removed");

  const { code, applied } = applyCatalogPreviewIntercept(streetHarborGoods);
  assert(applied, "intercept still applies to catalog-backed sources");
  const final = makePreviewSafeSource(sanitizePreviewSource(code), { soft: false }).code;
  let parsed = false;
  try {
    parse(final, { sourceType: "script", plugins: ["jsx"] });
    parsed = true;
  } catch {
    parse(final, { sourceType: "script", plugins: ["jsx", "typescript"] });
    parsed = true;
  }
  assert(parsed, "intercepted Street source parses (react or react+typescript)");
  assert(final.includes("HG-TOTE-001"), "merchant SKUs survive the intercept");
}

// Same crash family: a `// }` comment inside the PRODUCTS array used to
// truncate the extracted literal (comment-blind brace counting), injecting a
// broken `var CATALOG = …` statement.
{
  const withComment = `const PRODUCTS = [
  // } featured drop — do not reorder
  { id: "canvas-tote", sku: "HG-TOTE-001", title: "Canvas Tote", price: 4200 },
  { id: "field-notebook", sku: "HG-NOTE-002", title: "Field Notebook", price: 1800 },
];
export default function Component() {
  return <main>{PRODUCTS.map((p) => <div key={p.sku}>{p.title}</div>)}</main>;
}
`;
  const { code, applied } = applyCatalogPreviewIntercept(withComment);
  assert(applied, "intercept applies");
  assert(code.includes("field-notebook"), "extraction keeps the full array past the comment");
  const final = makePreviewSafeSource(sanitizePreviewSource(code), { soft: false }).code;
  parse(final, { sourceType: "script", plugins: ["jsx", "typescript"] });
}

// Object-literal and generic return types on stripped platform idents.
{
  const objRet = `function getProduct(id: string): { item: any } {
  return { item: PRODUCTS[0] };
}
const PRODUCTS = [{ id: "a", title: "A" }];
export default function Component() { return <main>{PRODUCTS[0].title}</main>; }`;
  const { code, applied } = applyCatalogPreviewIntercept(objRet);
  assert(applied, "intercept applies");
  const final = makePreviewSafeSource(sanitizePreviewSource(code), { soft: false }).code;
  parse(final, { sourceType: "script", plugins: ["jsx", "typescript"] });
  assert(!final.includes("{ item: any }"), "object-literal return type stripped with the decl");
  assert((final.match(/function getProduct/g) || []).length === 1, "exactly one getProduct binding (the platform's)");
}

// Structural gate: unknown mangling must fall back to un-intercepted source,
// never served broken.
{
  assert(!isStructurallySoundTsx("\n: string {\n  return 1;\n}"), "stray `: string {` fails the gate");
  assert(!isStructurallySoundTsx("function f() { return 1;"), "unbalanced input fails the gate");
  assert(
    isStructurallySoundTsx(`const x = 1;\nfunction f(): string { return "a"; }\nexport default function C() { return <div/>; }`),
    "valid TSX passes the gate"
  );
  // A ternary `:` at line start is valid — must not false-positive.
  assert(
    isStructurallySoundTsx(`const x = cond\n  ? a\n  : b;`),
    "multiline ternary passes the gate"
  );
}

// Per-file scope: a throwing top-level statement in a non-entry file must not
// abort the entry, and a non-entry Component binding must not replace it.
// Before the fix both cases produced an empty render (throw aborted the one
// shared script; `var Component = …` overwrote the hoisted entry) with no
// compile error — the Harbor Goods blank-root failure.
function renderPreviewEntry(code: string): string {
  const html = wrapCodeForPreview(code, theme);
  const embedded = html.match(/var source = ("(?:\\.|[^"\\])*");/);
  if (!embedded) throw new Error("preview html missing source");
  const source = JSON.parse(embedded[1]) as string;
  const js = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
    },
    fileName: "preview.tsx",
  });
  const loader = new Function(
    "React",
    "useState",
    js.outputText +
      "\n;var __entry = null;\n" +
      "try { if (typeof Component === 'function') __entry = Component; } catch (e) {}\n" +
      "try { if (!__entry && typeof App === 'function') __entry = App; } catch (e) {}\n" +
      "try { if (!__entry && typeof Page === 'function') __entry = Page; } catch (e) {}\n" +
      "return __entry;"
  );
  const Comp = loader(React, React.useState);
  if (typeof Comp !== "function") throw new Error("No function Component() found");
  return renderToStaticMarkup(React.createElement(Comp));
}

{
  const icons = `const ICONS = {
  "canvas-tote": (<svg viewBox="0 0 80 100"><rect width="80" height="100" /></svg>),
  "field-notebook": (<svg viewBox="0 0 80 100"><rect width="80" height="100" /></svg>),
  "steel-bottle": (<svg viewBox="0 0 80 100"><rect width="80" height="100" /></svg>),
};
`;
  const grid = `const PRODUCTS = [
  { id: "canvas-tote", sku: "HG-TOTE-001", title: "Canvas Tote", price: 4200 },
  { id: "field-notebook", sku: "HG-NOTE-002", title: "Field Notebook", price: 1800 },
  { id: "steel-bottle", sku: "HG-BOTL-003", title: "Steel Bottle", price: 3400 },
];
function formatMoney(cents) { return "$" + (cents / 100).toFixed(2); }
function ProductGrid() {
  return (
    <section>
      {PRODUCTS.map((p) => (
        <article key={p.sku}><h2>{p.title}</h2><p>{formatMoney(p.price)}</p></article>
      ))}
    </section>
  );
}
`;
  const entry = `function Component() {
  return (
    <main>
      <h1>Harbor Goods</h1>
      <ProductGrid />
    </main>
  );
}
`;
  const street = serializeProject(
    {
      "src/icons.tsx": icons,
      "src/boom.tsx": `throw new Error("non-entry top-level boom");\nfunction Helper(){ return <span>nope</span>; }\n`,
      "src/ProductGrid.tsx": grid,
      "src/Component.tsx": entry,
    },
    "src/Component.tsx"
  );
  const html = renderPreviewEntry(street);
  assert(/<h1[^>]*>Harbor Goods<\/h1>/.test(html), "entry H1 renders despite a throwing non-entry file");
  assert(html.includes("Canvas Tote"), "sibling component still mounted");
  assert(html.includes("$42.00"), "integer cents still format");
  assert(!html.includes("non-entry top-level boom"), "throw stays inside the file scope");

  const overwritten = serializeProject(
    {
      "src/stub.tsx": `var Component = function () { return null; };\n`,
      "src/Component.tsx": `function Component() {
  return <main><h1>Harbor Goods</h1></main>;
}
`,
    },
    "src/Component.tsx"
  );
  const kept = renderPreviewEntry(overwritten);
  assert(/<h1[^>]*>Harbor Goods<\/h1>/.test(kept), "non-entry var Component does not replace the entry");
}

// Regression: a non-entry helper file that throws must record its error
// into __adgenScopeErrors (surfaced as a visible error, never a silent blank).
{
  const street = serializeProject(
    {
      "src/boom.tsx": `throw new Error("Street module eval boom");\nfunction Helper(){ return null; }\n`,
      "src/Component.tsx": `function Component() { return <main><h1>Harbor Goods</h1></main>; }\n`,
    },
    "src/Component.tsx"
  );
  const scoped = scopePreviewScript(mergeForPreview(street));
  assert(
    scoped.includes("__adgenScopeErrors"),
    "scoped output records helper-file errors into __adgenScopeErrors"
  );
  assert(
    scoped.includes("Street module eval boom"),
    "the helper throw message is preserved for surfacing"
  );
  assert(
    scoped.includes("__error"),
    "the failed file is still marked with __error in the registry"
  );
  // The entry itself still mounts (existing behavior preserved).
  const html = renderPreviewEntry(street);
  assert(/<h1[^>]*>Harbor Goods<\/h1>/.test(html), "entry still mounts despite a throwing helper");
}

// Bare 'canvas-tote': <svg> in a non-entry file must not survive
// merge → scope → sanitize. The scope IIFE's `(` would otherwise hold
// paren depth at 1 and the sanitize rewrite would skip the key.
{
  const street = serializeProject(
    {
      "src/icons.tsx": `'canvas-tote': <svg viewBox="0 0 96 96" className="w-full h-full"><rect width="8" height="8" /></svg>\n'field-notebook': <svg viewBox="0 0 96 96" className="w-full h-full"><rect width="8" height="8" /></svg>\n`,
      "src/Component.tsx": `function Component() { return <main><h1>Harbor Goods</h1></main>; }\n`,
    },
    "src/Component.tsx"
  );
  const merged = mergeForPreview(street);
  const scoped = scopePreviewScript(merged);
  const cleaned = sanitizePreviewSource(scoped);
  assert(!/^\s*['"]canvas-tote['"]\s*:/m.test(cleaned), "no bare canvas-tote statement after the pipeline");
  assert(!/^\s*['"]field-notebook['"]\s*:/m.test(cleaned), "no bare field-notebook statement after the pipeline");
  assert(cleaned.includes("var __icon_canvas_tote ="), "rewritten before the scope wrapper");
  assert(cleaned.includes('"use strict"'), "non-entry file is still inside the scope wrapper");
  parse(cleaned, { sourceType: "script", plugins: ["jsx"] });

  const blocked = serializeProject(
    {
      "src/icons.tsx": `function Icons(\n'canvas-tote': <svg viewBox="0 0 96 96" className="w-full h-full"><rect /></svg>\n`,
      "src/Component.tsx": `function Component() { return <h1>Harbor Goods</h1>; }\n`,
    },
    "src/Component.tsx"
  );
  const blockedHtml = wrapCodeForPreview(blocked, theme);
  assert(
    !blockedHtml.includes('var __adgenBareKeyContext = "";'),
    "open-paren miss keeps the pre-rewrite fragment for the Babel error"
  );
  assert(blockedHtml.includes("function Icons("), "fragment shows the unclosed paren above the key");
  assert(blockedHtml.includes("Pre-rewrite fragment"), "Missing semicolon path prints that fragment");
}

// Regression: the preview HTML must surface a silent CDN-hang (blocking script
// never loads) instead of leaving a blank pane. A mount watchdog runs BEFORE the
// blocking CDN scripts, and each CDN script carries an onerror that surfaces a
// specific message with a refresh path.
{
  const html = wrapCodeForPreview(
    `function Component() { return <main><h1>Harbor Goods</h1></main>; }`,
    theme
  );
  assert(html.includes("__shipboardMountDone"), "watchdog state var present");
  assert(html.includes("WATCHDOG_MS"), "watchdog timeout present");
  assert(html.includes("__shipboardWatchdogFail"), "watchdog fail helper exposed");
  assert(
    /react\.production\.min\.js[^>]*onerror=/.test(html),
    "React CDN script has an onerror handler"
  );
  assert(
    /react-dom\.production\.min\.js[^>]*onerror=/.test(html),
    "ReactDOM CDN script has an onerror handler"
  );
  assert(
    /babel\.min\.js[^>]*onerror=/.test(html),
    "Babel CDN script has an onerror handler"
  );
  assert(
    html.includes("failed to load from the CDN"),
    "CDN failure message includes a specific, actionable reason"
  );
}

console.log("preview-html tests: all passed");

// REGRESSION (2026-09-23 Harbor Goods probe): a `declare const formatMoney`
// ambient declaration followed by interfaces and a component. The catalog
// stripper used to leave a dangling `declare`, and sanitize's multiline
// `declare` regex then ate the interfaces AND the `function ProductGrid`
// declaration line, producing "Unexpected token, expected ','" in the preview.
// The declaration must survive the full intercept + sanitize pipeline.
{
  const scoped = `(function (__adgenExports) {
    "use strict";
    declare const formatMoney: (cents: number, currency: string) => string;


interface Product {
  id: string;
}

interface ProductGridProps {
  products: Product[];
}

function ProductGrid({ products }: ProductGridProps) {
  return <div>{products.map((p: any) => <div key={p.id}>{p.title}</div>)}</div>;
}
    ;
    __adgenExports.ProductGrid = ProductGrid;
  })(__adgenBox);`;
  const intercepted = applyCatalogPreviewIntercept(scoped).code;
  assert(
    !intercepted.includes("declare const formatMoney"),
    "catalog stripper removes declare const formatMoney entirely (no dangling declare)"
  );
  const s = sanitizePreviewSource(intercepted);
  assert(
    s.includes("function ProductGrid("),
    "declare regex must not eat the function declaration"
  );
  assert(!/^\s*declare\b/m.test(s), "no dangling declare remains");
}
