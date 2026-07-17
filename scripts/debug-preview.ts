/**
 * Local verification of sanitize + Babel (react-only path used in iframe).
 * Run: npx tsx scripts/debug-preview.ts
 */
import * as BabelNS from "@babel/standalone";
import { sanitizePreviewSource, wrapCodeForPreview } from "../src/lib/preview-html";
import { PREVIEW_THEMES } from "../src/lib/types";
import { getPreviewInterceptBabelPluginSource } from "../src/lib/byob/preview-intercept";

// @babel/standalone default export varies by bundler / CJS interop
const Babel: { transform: (code: string, opts: object) => { code?: string | null } } =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BabelNS as any).default?.transform
    ? (BabelNS as any).default
    : (BabelNS as any).transform
      ? (BabelNS as any)
      : (BabelNS as any).default || BabelNS;

const cases: { name: string; code: string }[] = [
  {
    name: "simple",
    code: `function Component() {
  return <div className="min-h-screen p-8 text-white bg-zinc-950"><h1>Hi</h1></div>;
}`,
  },
  {
    name: "typed-props",
    code: `interface Props { title: string }
function Component({ title }: Props) {
  const [n, setN] = useState<number>(0);
  return <div className="p-4" onClick={() => setN(n+1)}>{title}{n}</div>;
}`,
  },
  {
    name: "actions-import",
    code: `import { listUsers } from "@/app/actions";
function Component() {
  useEffect(() => { listUsers().then(console.log); }, []);
  return <div className="p-4">Users</div>;
}`,
  },
  {
    name: "export-default",
    code: `export default function Component() {
  return <div className="p-8">Exported</div>;
}`,
  },
  {
    name: "react-fc",
    code: `const Component: React.FC = () => {
  const [v, setV] = useState<string>("ok");
  return <div className="p-4">{v}</div>;
}`,
  },
  {
    name: "lucide-style",
    code: `function Component() {
  return (
    <div className="flex gap-2">
      <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
      <span>Icon</span>
    </div>
  );
}`,
  },
];

const pluginSrc = getPreviewInterceptBabelPluginSource();
// eslint-disable-next-line no-eval
const plugin = eval(`(${pluginSrc})`);

let failed = 0;

function tryBabel(label: string, source: string) {
  const cleaned = sanitizePreviewSource(source);
  console.log("\n===", label, "===");
  console.log("cleaned:", cleaned.slice(0, 200).replace(/\n/g, "\\n"));

  // Residual TS that would break react-only
  const residualTs =
    /:\s*(Props|string|number|boolean|any)\b/.test(cleaned) ||
    /useState\s*</.test(cleaned) ||
    /useRef\s*</.test(cleaned) ||
    /\binterface\s+\w+/.test(cleaned) ||
    /React\.FC/.test(cleaned);
  if (residualTs) {
    console.log("WARN residual TS after sanitize");
    failed++;
  }

  try {
    if (typeof Babel.transform !== "function") {
      throw new Error("Babel.transform missing — keys: " + Object.keys(Babel as object).join(","));
    }
    const r = Babel.transform(cleaned, {
      presets: [["react", { runtime: "classic" }]],
      plugins: [plugin],
      filename: "Component.jsx",
      sourceType: "script",
    });
    const code = r.code || "";
    console.log("OK transform", code.length);

    // Prove entry recovery via new Function (same pattern as iframe)
    const body =
      code +
      "\n; var __e=null; try{if(typeof Component==='function')__e=Component;}catch(_){}" +
      "try{if(!__e&&typeof App==='function')__e=App;}catch(_){} return __e;";
    const fakeReact = {
      createElement: (..._a: unknown[]) => null,
      useState: (x: unknown) => [x, () => {}],
      useEffect: () => {},
      useRef: () => ({ current: null }),
      useCallback: (fn: unknown) => fn,
      useMemo: (fn: () => unknown) => fn(),
      useReducer: () => [null, () => {}],
      createContext: () => ({}),
      useContext: () => null,
      Fragment: "Fragment",
      useLayoutEffect: () => {},
      useId: () => "id",
    };
    const fn = new Function(
      "React",
      "useState",
      "useEffect",
      "useRef",
      "useCallback",
      "useMemo",
      "useReducer",
      "createContext",
      "useContext",
      "Fragment",
      "useLayoutEffect",
      "useId",
      "MOCK_DATA",
      body
    );
    let entry: unknown = null;
    try {
      entry = fn(
        fakeReact,
        fakeReact.useState,
        fakeReact.useEffect,
        fakeReact.useRef,
        fakeReact.useCallback,
        fakeReact.useMemo,
        fakeReact.useReducer,
        fakeReact.createContext,
        fakeReact.useContext,
        fakeReact.Fragment,
        fakeReact.useLayoutEffect,
        fakeReact.useId,
        {}
      );
    } catch (re) {
      console.log("runtime", re instanceof Error ? re.message : re);
      failed++;
    }
    console.log("entry", typeof entry);
    if (typeof entry !== "function") {
      console.log("FAIL no Component entry");
      failed++;
    }
  } catch (e: unknown) {
    failed++;
    console.log("FAIL", e instanceof Error ? e.message.split("\n")[0] : e);
  }

  const html = wrapCodeForPreview(source, PREVIEW_THEMES[0]);
  console.log("html loader", html.includes("new Function"));
  if (!html.includes("new Function")) failed++;
}

for (const c of cases) tryBabel(c.name, c.code);

console.log(failed ? `\nFAILED ${failed}` : "\nALL OK");
process.exit(failed ? 1 : 0);
