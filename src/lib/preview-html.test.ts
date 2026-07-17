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
