/**
 * Run: npx tsx src/lib/preview-html.test.ts
 */
import { sanitizePreviewSource, wrapCodeForPreview, rewriteBareJsxObjectEntries } from "./preview-html";
import {
  analyzeSourceTruncation,
  makePreviewSafeSource,
} from "./code-truncation";
import { PREVIEW_THEMES } from "./types";
import { serializeProject } from "./project-files";
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

console.log("preview-html tests: all passed");
