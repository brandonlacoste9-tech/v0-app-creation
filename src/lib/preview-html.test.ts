/**
 * Run: npx tsx src/lib/preview-html.test.ts
 */
import { sanitizePreviewSource, wrapCodeForPreview } from "./preview-html";
import {
  analyzeSourceTruncation,
  makePreviewSafeSource,
} from "./code-truncation";
import { PREVIEW_THEMES } from "./types";
import { serializeProject } from "./project-files";

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

// object literals: price: 0 must stay (not become shorthand → ReferenceError)
{
  const raw = `function Component() {
  const plans = [
    { name: "Free", price: 0, features: ["A"] },
    { name: "Pro", price: 25 },
  ];
  return <div>{plans.map((p) => p.price)}</div>;
}`;
  const s = sanitizePreviewSource(raw);
  assert(s.includes("price: 0"), "keep price: 0");
  assert(s.includes("price: 25"), "keep price: 25");
  assert(!/\bprice\s*,/.test(s), "no price shorthand");
  // still strip real param types
  const typed = sanitizePreviewSource(
    `function Component() {
  const go = (e: React.MouseEvent, n: number) => n;
  return <button onClick={go}>x</button>;
}`
  );
  assert(!typed.includes("React.MouseEvent"), "still strip event types");
  assert(!typed.includes("n: number"), "still strip number params");
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

console.log("preview-html tests: all passed");
