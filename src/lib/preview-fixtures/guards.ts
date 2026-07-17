/**
 * Residual TypeScript / module markers that break Babel react-only in the iframe.
 * Used by the fixture suite as the defense-layer oracle — not perfect, intentionally
 * conservative false-negative bias is better than false-positive on valid JSX.
 */

/** Patterns that should not survive sanitize on complete (non-truncated) sources. */
export const RESIDUAL_TS_PATTERNS: { id: string; re: RegExp }[] = [
  { id: "interface-decl", re: /^\s*interface\s+[A-Za-z_$]/m },
  { id: "type-alias-decl", re: /^\s*type\s+[A-Za-z_$][\w$]*\s*=/m },
  { id: "enum-decl", re: /^\s*enum\s+[A-Za-z_$]/m },
  { id: "react-fc", re: /React\.FC\b/ },
  { id: "import-from", re: /\bimport\s+[\s\S]*?\bfrom\s+['"]/ },
  { id: "export-default", re: /\bexport\s+default\b/ },
  { id: "export-type", re: /\bexport\s+type\b/ },
  { id: "as-const", re: /\bas\s+const\b/ },
  { id: "satisfies", re: /\bsatisfies\s+/ },
  // Call generics that leak: useState<number>(  — not JSX (JSX has <ident after <)
  { id: "hook-generic-call", re: /\buse(?:State|Ref|Memo|Callback|Reducer|Context)\s*</ },
  // Destructure param typed with capital Props/Type name: }: Props) or }: Foo)
  { id: "destructure-type", re: /\}\s*:\s*[A-Z][A-Za-z0-9_.<]*\s*\)/ },
  // Simple param type with capital or primitive after bare ident: (x: string) already stripped
  // Catch leftover `: string` on const rarely — handled per-fixture mustStrip
];

export interface ResidualHit {
  id: string;
  match: string;
}

export function findResidualTs(cleaned: string): ResidualHit[] {
  const hits: ResidualHit[] = [];
  for (const p of RESIDUAL_TS_PATTERNS) {
    const m = cleaned.match(p.re);
    if (m) hits.push({ id: p.id, match: m[0].slice(0, 80) });
  }
  return hits;
}

/**
 * Prove the same mount path as the iframe: new Function + return Component|App|Page.
 * Uses a minimal React stub so createElement/hooks don't throw during load.
 */
export function tryMountEntry(
  transformedJs: string
): { ok: true; entry: string } | { ok: false; error: string } {
  const fakeReact = {
    createElement: (..._a: unknown[]) => null,
    useState: (x: unknown) => [x, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => {
      try {
        return fn();
      } catch {
        return undefined;
      }
    },
    useReducer: () => [null, () => {}],
    createContext: () => ({}),
    useContext: () => null,
    Fragment: "Fragment",
    useLayoutEffect: () => {},
    useId: () => "fixture-id",
  };

  const body =
    transformedJs +
    "\n; var __e=null;" +
    "try{if(typeof Component==='function')__e=Component;}catch(_){}" +
    "try{if(!__e&&typeof App==='function')__e=App;}catch(_){}" +
    "try{if(!__e&&typeof Page==='function')__e=Page;}catch(_){}" +
    "return __e;";

  try {
    const fn = new Function(
      "React",
      "ReactDOM",
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
      "require",
      "module",
      "exports",
      "process",
      "Buffer",
      "MOCK_DATA",
      body
    );
    const entry = fn(
      fakeReact,
      { createRoot: () => ({ render: () => {} }) },
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
      () => ({}),
      { exports: {} },
      {},
      { env: { NODE_ENV: "test" }, browser: true },
      { from: () => ({ toString: () => "", length: 0 }), isBuffer: () => false },
      {}
    );
    if (typeof entry !== "function") {
      return { ok: false, error: "no Component/App/Page entry after mount" };
    }
    const name =
      entry.name === "App" || entry.name === "Page" || entry.name === "Component"
        ? entry.name
        : "anonymous";
    return { ok: true, entry: name };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message.split("\n")[0] : String(e),
    };
  }
}

export function resolveBabel(): {
  transform: (code: string, opts: object) => { code?: string | null };
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@babel/standalone") as Record<string, unknown>;
    const B = (mod.default && typeof (mod.default as { transform?: unknown }).transform === "function"
      ? mod.default
      : mod) as { transform?: (code: string, opts: object) => { code?: string | null } };
    if (typeof B.transform === "function") return B as {
      transform: (code: string, opts: object) => { code?: string | null };
    };
  } catch {
    // optional — suite still validates sanitize + wrap
  }
  return null;
}
