/**
 * Eject safety: export order, merchant names, prompt leaks, and a pre-push gate.
 * Studio preview strips `export` and treats hooks as globals. Ship must not.
 */

export const PROMPT_LEAK_MARKERS = [
  "Do not claim the preview compiles",
  "Requirements: real useState where needed",
  "Fix these UI quality issues",
  "Return FULL multi-file sources",
  "The platform Babel-checks the result",
  "preview now compiles cleanly",
] as const;

const REACT_HOOKS = [
  "useState",
  "useEffect",
  "useRef",
  "useMemo",
  "useCallback",
  "useReducer",
  "useContext",
  "useId",
  "useLayoutEffect",
  "useImperativeHandle",
] as const;

export class EjectCompileError extends Error {
  blockers: string[];

  constructor(blockers: string[]) {
    const shown = blockers.slice(0, 8);
    const more =
      blockers.length > shown.length
        ? `\n…and ${blockers.length - shown.length} more.`
        : "";
    super(
      [
        "Eject blocked — nothing was pushed. The project does not compile.",
        ...shown,
      ].join("\n") + more
    );
    this.name = "EjectCompileError";
    this.blockers = blockers;
  }
}

export function containsPromptLeak(text: string): boolean {
  return PROMPT_LEAK_MARKERS.some((marker) => text.includes(marker));
}

export function isCleanMerchantName(name: string): boolean {
  const flat = name.replace(/\s+/g, " ").trim();
  if (!flat || flat.length > 80) return false;
  if (/[\r\n]/.test(name)) return false;
  if (containsPromptLeak(name)) return false;
  if (/^(fix|replace|update|requirements|return)\b/i.test(flat)) return false;
  if (/\bQA score\b/i.test(flat)) return false;
  return true;
}

export function humanizeSlug(slug: string): string {
  const name = slug
    .split(/[-_\s]+/)
    .filter((word) => word && !/^\d+$/.test(word))
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .trim();
  return isCleanMerchantName(name) ? name : "Store";
}

/** Most common product brand, when the store title itself is a prompt. */
export function brandFromProducts(productsLiteral?: string | null): string | null {
  if (!productsLiteral) return null;
  const counts = new Map<string, number>();
  for (const match of productsLiteral.matchAll(
    /["']brand["']\s*:\s*["']([^"'\n]{1,80})["']/g
  )) {
    const brand = match[1].trim();
    if (!isCleanMerchantName(brand)) continue;
    counts.set(brand, (counts.get(brand) || 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [brand, count] of counts) {
    if (count > n) {
      best = brand;
      n = count;
    }
  }
  return best;
}

export function resolveMerchantName(opts: {
  title?: string | null;
  productsLiteral?: string | null;
  fallback?: string | null;
}): string {
  const title = (opts.title || "").trim();
  if (isCleanMerchantName(title)) return title.replace(/\s+/g, " ");
  const brand = brandFromProducts(opts.productsLiteral);
  if (brand) return brand;
  const fallback = (opts.fallback || "").trim();
  if (isCleanMerchantName(fallback)) return fallback.replace(/\s+/g, " ");
  return "Store";
}

/** `async export` is a syntax error. `export` comes first. */
export function repairExportOrder(src: string): string {
  return src
    .replace(/\basync\s+export\s+default\s+function\b/g, "export default async function")
    .replace(/\basync\s+export\s+function\b/g, "export async function")
    .replace(/\basync\s+export\s+default\b/g, "export default async")
    .replace(/\basync\s+export\b/g, "export async");
}

export function isRouteModulePath(path: string): boolean {
  return /(?:^|\/)route\.(tsx?|jsx?)$/i.test(path.replace(/\\/g, "/"));
}

/** App Router and lib modules are already Next source. Do not repackage them as Vite components. */
export function isNextServerPath(path: string): boolean {
  const p = path.replace(/\\/g, "/");
  return /^(app|pages|lib)\//.test(p) || isRouteModulePath(p);
}

/**
 * Route handlers are named exports. A default export is typed `never` by Next
 * (`Type '() => Promise<NextResponse>' is not assignable to type 'never'`).
 * OPTIONS takes `req: Request`, same as GET/POST.
 */
export function repairRouteHandlers(src: string): string {
  let next = repairExportOrder(src);
  next = next.replace(
    /(^|\n)([ \t]*)(?:export\s+default\s+|export\s+)?(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g,
    (_match, lead: string, ws: string, asyncKw: string | undefined, method: string) =>
      `${lead}${ws}export ${asyncKw || ""}function ${method}(`
  );
  next = next.replace(
    /export\s+(async\s+)?function\s+OPTIONS\s*\(\s*\)/g,
    (_match, asyncKw: string | undefined) =>
      `export ${asyncKw || "async "}function OPTIONS(req: Request)`
  );
  return next;
}

/** Put `export default` before `async`, never between `async` and `function`. */
export function promoteFunctionToDefaultExport(body: string, name: string): string {
  const re = new RegExp(`(^|[\\n;])(\\s*)(async\\s+)?function\\s+${name}\\s*\\(`);
  return body.replace(
    re,
    (_match, lead: string, ws: string, asyncKw: string | undefined) =>
      `${lead}${ws}export default ${asyncKw ? "async " : ""}function ${name}(`
  );
}

function annotateParamList(params: string): string {
  const trimmed = params.trim();
  if (!trimmed || trimmed.includes(":")) return params;
  if (trimmed.includes("{") || trimmed.includes("}")) {
    return `${params}: Record<string, any>`;
  }
  return trimmed
    .split(",")
    .map((part) => {
      const name = part.trim();
      if (!name || name.includes(":")) return name;
      const eq = name.indexOf("=");
      if (eq !== -1) {
        const left = name.slice(0, eq).trim();
        const right = name.slice(eq + 1).trim();
        return `${left}: any = ${right}`;
      }
      if (name.startsWith("...")) return `${name}: any[]`;
      return `${name}: any`;
    })
    .join(", ");
}

/**
 * Studio is told to omit types. The ejected tsconfig is strict, so untyped
 * parameters fail `npm run build`. Annotate only lists that have no types yet.
 */
export function annotateImplicitAny(src: string): string {
  let next = src.replace(
    /(function(?:\s+[A-Za-z_$][\w$]*)?\s*)\(([^()]*)\)/g,
    (full, lead: string, params: string) => {
      if (!params.trim() || params.includes(":")) return full;
      return `${lead}(${annotateParamList(params)})`;
    }
  );
  next = next.replace(/\(([^()]*)\)(\s*=>)/g, (full, params: string, arrow: string) => {
    if (!params.trim() || params.includes(":")) return full;
    return `(${annotateParamList(params)})${arrow}`;
  });
  next = next.replace(
    /(^|[^.\w$])([A-Za-z_$][\w$]*)(\s*=>)/g,
    (full, lead: string, name: string, arrow: string) => {
      if (
        ["if", "for", "while", "switch", "catch", "return", "typeof", "async", "await"].includes(
          name
        )
      ) {
        return full;
      }
      return `${lead}(${name}: any)${arrow}`;
    }
  );
  return next;
}

/** `new URLSearchParams(window.location.search)` crashes SSR during `next build`. */
export function guardWindowLocation(src: string): string {
  return src.replace(
    /new URLSearchParams\(\s*window\.location\.search\s*\)/g,
    "(typeof window === \"undefined\" ? new URLSearchParams() : new URLSearchParams(window.location.search))"
  );
}

export function ensureReactImports(src: string): string {
  const hooks = REACT_HOOKS.filter((hook) => new RegExp(`\\b${hook}\\b`).test(src));
  const needsNamespace = /\bReact\./.test(src);
  const imported = new Set<string>();
  let hasNamespace = false;
  for (const match of src.matchAll(/import\s+(type\s+)?([^;]*?)\s+from\s+["']react["']/g)) {
    if (!match[1] && /\bReact\b/.test(match[2])) hasNamespace = true;
    const brace = match[2].match(/\{([^}]+)\}/);
    if (!brace) continue;
    for (const part of brace[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) imported.add(name);
    }
  }
  const missingHooks = hooks.filter((hook) => !imported.has(hook));
  const missingNamespace = needsNamespace && !hasNamespace;
  // Drop every directive first. Sibling imports are prepended above a directive
  // that was already in the body, and Next rejects "use client" anywhere but line 1.
  let next = src.replace(/^\s*["']use client["'];?\s*\n/gm, "");
  if (missingHooks.length || missingNamespace) {
    const line =
      missingNamespace && missingHooks.length
        ? `import React, { ${missingHooks.join(", ")} } from "react";\n`
        : missingNamespace
          ? `import React from "react";\n`
          : `import { ${missingHooks.join(", ")} } from "react";\n`;
    next = line + next;
  }
  const needsClient =
    hooks.length > 0 || missingNamespace || needsNamespace || /\bon[A-Z][A-Za-z]+\s*=/.test(next);
  if (needsClient && !/^\s*["']use client["']/.test(next)) {
    next = `"use client";\n${next}`;
  }
  return next;
}

export function finalizeShipModule(path: string, source: string): string {
  const filePath = path.replace(/\\/g, "/");
  if (isRouteModulePath(filePath)) return ensureTrailingNewline(repairRouteHandlers(source));
  if (isNextServerPath(filePath)) return ensureTrailingNewline(repairExportOrder(source));

  let next = repairExportOrder(source);
  next = guardWindowLocation(next);
  next = annotateImplicitAny(next);
  next = next.replace(/\buseState\(\s*null\s*\)/g, "useState<any>(null)");
  if (/\.(tsx|jsx)$/i.test(filePath)) next = ensureReactImports(next);
  return ensureTrailingNewline(next);
}

function ensureTrailingNewline(source: string): string {
  return source.endsWith("\n") ? source : source + "\n";
}

export function structuralEjectBlockers(files: { path: string; content: string }[]): string[] {
  const blockers: string[] = [];
  for (const file of files) {
    if (containsPromptLeak(file.content)) {
      blockers.push(
        `${file.path}: prompt text leaked into source ("Do not claim the preview compiles"). Refused.`
      );
    }
    if (/\basync\s+export\b/.test(file.content)) {
      blockers.push(
        `${file.path}: invalid syntax \`async export\`. Use \`export async function\` or \`export default async function\`.`
      );
    }
    if (!isRouteModulePath(file.path)) continue;
    if (/\bexport\s+default\b/.test(file.content)) {
      blockers.push(
        `${file.path}: route handlers must be named exports (\`export async function OPTIONS\`), not a default export.`
      );
    }
    if (
      /\bfunction\s+OPTIONS\s*\(/.test(file.content) &&
      !/export\s+async\s+function\s+OPTIONS\s*\(\s*req\s*:\s*Request\b/.test(file.content)
    ) {
      blockers.push(
        `${file.path}: OPTIONS must be \`export async function OPTIONS(req: Request)\`, same as GET/POST.`
      );
    }
  }
  return blockers;
}
