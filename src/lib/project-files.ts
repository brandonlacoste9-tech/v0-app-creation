/**
 * Multi-file project bundle for Shipboard.
 * Stored as either plain TSX (legacy) or a JSON envelope in the version `code` field.
 */

import {
  bareJsxKeyRewriteMiss,
  rewriteBareJsxObjectEntries,
  sealPreviewFragment,
} from "./code-truncation";
import {
  finalizeShipModule,
  isNextServerPath,
  promoteFunctionToDefaultExport,
  repairExportOrder,
} from "./eject-gate";

export const PROJECT_MARKER = "__ADGEN_PROJECT_V1__";

export type ProjectFiles = Record<string, string>;

export interface ProjectBundle {
  v: 1;
  entry: string;
  files: ProjectFiles;
}

export function isProjectBundle(code: string): boolean {
  const t = code.trim();
  return t.startsWith(`{${PROJECT_MARKER}`) || t.startsWith(`{"${PROJECT_MARKER}"`) || t.includes(`"${PROJECT_MARKER}"`);
}

/** Serialize multi-file project for storage. */
export function serializeProject(files: ProjectFiles, entry = "src/Component.tsx"): string {
  const normalized: ProjectFiles = {};
  for (const [path, content] of Object.entries(files)) {
    if (content?.trim()) normalized[normalizePath(path)] = content;
  }
  if (!normalized[entry] && Object.keys(normalized).length > 0) {
    const first = Object.keys(normalized)[0];
    entry = first;
  }
  const bundle: ProjectBundle & { [PROJECT_MARKER]?: true } = {
    v: 1,
    entry,
    files: normalized,
    [PROJECT_MARKER]: true,
  };
  return JSON.stringify(bundle);
}

/** Parse stored code into a project bundle (single-file → one Component). */
export function parseProject(code: string): ProjectBundle {
  const trimmed = code?.trim() || "";
  if (!trimmed) {
    return {
      v: 1,
      entry: "src/Component.tsx",
      files: { "src/Component.tsx": "" },
    };
  }

  try {
    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed) as ProjectBundle & {
        [key: string]: unknown;
      };
      if (parsed?.v === 1 && parsed.files && typeof parsed.files === "object") {
        return {
          v: 1,
          entry: parsed.entry || "src/Component.tsx",
          files: parsed.files as ProjectFiles,
        };
      }
    }
  } catch {
    /* plain TSX */
  }

  return {
    v: 1,
    entry: "src/Component.tsx",
    files: { "src/Component.tsx": code },
  };
}

export function normalizePath(path: string): string {
  let p = path.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!p.includes("/")) p = `src/${p}`;
  if (!/\.(tsx?|jsx?|css|json|md|svg)$/i.test(p)) p = `${p}.tsx`;
  return p;
}

export function getEntryCode(code: string): string {
  const project = parseProject(code);
  return project.files[project.entry] || Object.values(project.files)[0] || "";
}

export function listProjectFiles(code: string): { path: string; content: string }[] {
  const project = parseProject(code);
  return Object.entries(project.files)
    .map(([path, content]) => ({ path, content }))
    .sort((a, b) => {
      if (a.path === project.entry) return -1;
      if (b.path === project.entry) return 1;
      return a.path.localeCompare(b.path);
    });
}

/**
 * Files that belong in the iframe merge and the iterate prompt.
 * Eject-only Next routes / commerce stack stay on the version for Code + GitHub
 * but must never hit Babel (one script scope) or the 28k iterate clip.
 */
export function isPreviewUiFile(path: string, entry?: string): boolean {
  const p = path.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (entry && p === entry) return true;
  if (!/\.(tsx?|jsx?)$/i.test(p)) return false;
  if (/\.svg\.tsx?$/i.test(p)) return false;
  if (/^(app|pages|api|public)\//i.test(p)) return false;
  if (
    /(?:^|\/)lib\/(catalog|checkout|commerce-types|orders|channel|ucp)\.(t|j)sx?$/i.test(
      p
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Merge all TS/JS files into one script for the iterate prompt and as the
 * input to scopePreviewScript. Non-entry files first, entry last.
 * Do not evaluate this string as one scope — see scopePreviewScript.
 */
export function mergeForPreview(code: string): string {
  const project = parseProject(code);
  const paths = Object.keys(project.files);
  const others = paths.filter(
    (p) =>
      p !== project.entry &&
      isPreviewUiFile(p, project.entry)
  );
  const parts: string[] = [];

  for (const p of others) {
    parts.push(
      `/* --- ${p} --- */\n${sealPreviewFragment(stripModuleSyntax(project.files[p]))}`
    );
  }
  const entry = project.files[project.entry] || "";
  parts.push(
    `/* --- ${project.entry} --- */\n${sealPreviewFragment(stripModuleSyntax(entry))}`
  );
  return parts.join("\n\n");
}

const PREVIEW_FILE_MARK = /\/\* --- (.+?) --- \*\//g;

/** Names the iframe loader treats as the entry. Never imported from another file. */
const PREVIEW_ENTRY_NAMES = new Set(["Component", "App", "Page"]);

/**
 * Platform catalog bindings are injected once, outside every file scope.
 * Re-binding them from a file would shadow that injection.
 */
const PREVIEW_PLATFORM_NAMES = new Set([
  "PRODUCTS",
  "CATALOG",
  "getProduct",
  "searchProducts",
  "formatMoney",
  "createCheckoutSession",
]);

function skipPreviewString(src: string, i: number): number {
  const q = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}

function skipPreviewComment(src: string, i: number): number {
  if (src[i + 1] === "/") {
    const nl = src.indexOf("\n", i + 2);
    return nl < 0 ? src.length : nl + 1;
  }
  const end = src.indexOf("*/", i + 2);
  return end < 0 ? src.length : end + 2;
}

/** Top-level function and const/let/var names. Ignores nested declarations. */
export function topLevelBindingNames(src: string): string[] {
  const names: string[] = [];
  let i = 0;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipPreviewString(src, i);
      continue;
    }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
      i = skipPreviewComment(src, i);
      continue;
    }
    if (c === "{") {
      depth++;
      i++;
      continue;
    }
    if (c === "}") {
      if (depth > 0) depth--;
      i++;
      continue;
    }
    if (depth === 0) {
      const rest = src.slice(i);
      const fn = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(
        rest
      );
      if (fn) {
        names.push(fn[1]);
        i += fn[0].length;
        continue;
      }
      const decl =
        /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b(?:\s*:\s*[^=]+)?\s*=/.exec(
          rest
        );
      if (decl) {
        names.push(decl[1]);
        i += decl[0].length;
        continue;
      }
    }
    i++;
  }
  return [...new Set(names)];
}

/**
 * Evaluate each non-entry file in its own strict scope.
 *
 * mergeForPreview is one sloppy script. Function declarations hoist, then
 * top-level statements in earlier files run before the entry finishes
 * initializing. A `throw` aborts the loader before it can return the entry.
 * A non-entry `Component = …` or `var Component = …` replaces the hoisted
 * entry and React commits an empty tree — Babel already succeeded, so there
 * is no compile banner.
 *
 * Option B (drop non-component statements) would also drop the icon map and
 * the catalog literals those files exist to provide. A strict IIFE keeps
 * them when the file evaluates, and a throw stays inside that file.
 * Component / App / Page are never copied out of a non-entry file.
 */
export function scopePreviewScript(merged: string): string {
  return buildScopedPreview(merged).code;
}

/**
 * Same as scopePreviewScript, plus the pre-rewrite text of any non-entry
 * file whose bare `'key': <jsx>` lines the rewrite refused (open paren above
 * the key). Empty when every such line was rewritten.
 */
export function buildScopedPreview(merged: string): { code: string; bareKeyContext: string } {
  const marks: { path: string; commentAt: number; bodyStart: number }[] = [];
  PREVIEW_FILE_MARK.lastIndex = 0;
  let mark: RegExpExecArray | null;
  while ((mark = PREVIEW_FILE_MARK.exec(merged))) {
    marks.push({
      path: mark[1],
      commentAt: mark.index,
      bodyStart: mark.index + mark[0].length,
    });
  }
  if (marks.length === 0) return { code: merged, bareKeyContext: "" };

  const files = marks.map((item, index) => {
    const end = index + 1 < marks.length ? marks[index + 1].commentAt : merged.length;
    return { path: item.path, body: merged.slice(item.bodyStart, end).trim() };
  });

  const entry = files[files.length - 1];
  const entryNames = new Set(topLevelBindingNames(entry.body));
  const chunks: string[] = ["var __adgenRegistry = {};"];
  const preamble = merged.slice(0, marks[0].commentAt).trim();
  if (preamble) chunks.unshift(preamble);
  const misses: string[] = [];

  for (const file of files.slice(0, -1)) {
    // Rewrite while the body is still at paren depth 0. The IIFE below opens
    // a `(` that does not close until after the body, so a later
    // sanitizePreviewSource pass cannot see these keys.
    const missed = bareJsxKeyRewriteMiss(file.body);
    if (missed) misses.push(`// ${file.path}\n${missed}`);
    const body = rewriteBareJsxObjectEntries(file.body);
    const names = topLevelBindingNames(body).filter(
      (name) =>
        !PREVIEW_ENTRY_NAMES.has(name) &&
        !PREVIEW_PLATFORM_NAMES.has(name) &&
        !entryNames.has(name)
    );
    const pathLit = JSON.stringify(file.path);
    const exportLines = names.map((name) => `__adgenExports.${name} = ${name};`).join("\n");
    const assignLines = names
      .map((name) => `var ${name} = __adgenRegistry[${pathLit}].${name};`)
      .join("\n");
    chunks.push(
      `try {
  var __adgenBox = {};
  (function (__adgenExports) {
    "use strict";
    ${body}
    ${exportLines}
  })(__adgenBox);
  __adgenRegistry[${pathLit}] = __adgenBox;
  ${assignLines}
} catch (__adgenFileErr) {
  __adgenRegistry[${pathLit}] = { __error: __adgenFileErr && __adgenFileErr.message ? String(__adgenFileErr.message) : String(__adgenFileErr) };
}`
    );
  }

  const entryMiss = bareJsxKeyRewriteMiss(entry.body);
  if (entryMiss) misses.push(`// ${entry.path}\n${entryMiss}`);
  chunks.push(`/* --- ${entry.path} --- */\n${entry.body}`);
  return { code: chunks.join("\n\n"), bareKeyContext: misses.join("\n\n") };
}

/**
 * Strip module syntax for iframe merge, or for ship packaging of local files.
 * @param preserveAppImports — keep `@/app/actions` and `@/lib/*` (ship/Next parity)
 */
function stripModuleSyntax(
  src: string,
  opts?: { preserveAppImports?: boolean }
): string {
  let s = src;
  const preserved: string[] = [];

  if (opts?.preserveAppImports) {
    s = s.replace(
      /import\s+[\s\S]*?from\s+['"](@\/(?:app\/actions|lib\/[^'"]+))['"]\s*;?/g,
      (full) => {
        preserved.push(full.trim().endsWith(";") ? full.trim() : full.trim() + ";");
        return "\n";
      }
    );
  }

  s = s
    .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  if (preserved.length) {
    s = preserved.join("\n") + "\n\n" + s;
  }
  return s;
}

/** File path → component name: src/Hero.tsx → Hero */
export function pathToExportName(path: string): string {
  const base = path.split("/").pop() || "Component";
  const name = base.replace(/\.(tsx?|jsx?|css)$/i, "");
  const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, "") || "Component";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function firstCapitalFunction(code: string): string | null {
  const m = code.match(/(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/);
  return m?.[1] ?? null;
}

/**
 * Convert Shipboard no-import multi-file sources into proper ES modules for Vite.
 * - Non-entry files: export default FunctionName
 * - Entry (Component.tsx): import siblings + export default Component
 */
export function packageForVite(code: string): ProjectFiles {
  const project = parseProject(code);
  const tsPaths = Object.keys(project.files).filter((p) =>
    /\.(tsx?|jsx?)$/i.test(p)
  );
  const out: ProjectFiles = {};

  // Non-TS assets pass through
  for (const [path, content] of Object.entries(project.files)) {
    if (!/\.(tsx?|jsx?)$/i.test(path)) out[path] = content;
  }

  if (tsPaths.length <= 1) {
    const entry = project.entry;
    let body = repairExportOrder(stripModuleSyntax(project.files[entry] || code));
    if (!/export\s+default/.test(body)) {
      if (/(?:async\s+)?function\s+Component\s*\(/.test(body)) {
        body = promoteFunctionToDefaultExport(body, "Component");
      } else {
        body = body.trimEnd() + "\n\nexport default Component;\n";
      }
    }
    const outPath = entry.startsWith("src/") ? entry : "src/Component.tsx";
    out[outPath] = finalizeShipModule(outPath, body);
    return out;
  }

  const entryPath = project.files[project.entry]
    ? project.entry
    : tsPaths.find((p) => /component/i.test(p)) || tsPaths[0];

  const modules: { path: string; name: string; body: string }[] = [];

  for (const path of tsPaths) {
    const raw = project.files[path] || "";
    // Next routes, pages, and lib modules are already ES modules. Rewriting the
    // first capitalized function into a default export turns
    // `export async function OPTIONS` into `async export default function OPTIONS`.
    if (isNextServerPath(path)) {
      out[path] = finalizeShipModule(path, raw);
      continue;
    }
    // Preserve @/app/actions + @/lib/* for Next ship (true production imports)
    let body = stripModuleSyntax(raw, { preserveAppImports: true });
    const name =
      firstCapitalFunction(body) || pathToExportName(path);
    const isEntry = path === entryPath;

    if (!isEntry) {
      // Prefer export default function Name — `async` stays before `function`.
      if (new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(body)) {
        body = promoteFunctionToDefaultExport(body, name);
      } else if (new RegExp(`const\\s+${name}\\s*=`).test(body)) {
        if (!/export\s+default/.test(body)) {
          body = body.trimEnd() + `\n\nexport default ${name};\n`;
        }
      } else if (!/export\s+default/.test(body)) {
        body =
          body.trimEnd() +
          `\n\nexport default function ${name}() {\n  return null;\n}\n`;
      }
      modules.push({ path, name, body });
      out[path] = body.endsWith("\n") ? body : body + "\n";
    } else {
      modules.push({ path, name: "Component", body });
    }
  }

  // Entry with imports
  const entryMod = modules.find((m) => m.path === entryPath)!;
  // Re-extract preserved app imports from entry before sibling imports
  const preservedApp = (
    entryMod.body.match(
      /import\s+[\s\S]*?from\s+['"]@\/(?:app\/actions|lib\/[^'"]+)['"]\s*;?/g
    ) || []
  ).join("\n");
  let entryBody = entryMod.body
    .replace(
      /import\s+[\s\S]*?from\s+['"]@\/(?:app\/actions|lib\/[^'"]+)['"]\s*;?/g,
      ""
    )
    .trim();
  const imports = modules
    .filter((m) => m.path !== entryPath)
    .map((m) => {
      const rel = "./" + m.path.replace(/^src\//, "").replace(/\.(tsx?|jsx?)$/i, "");
      return `import ${m.name} from "${rel}";`;
    })
    .join("\n");
  // Avoid re-declaring imported components if AI duplicated them in entry
  for (const m of modules.filter((x) => x.path !== entryPath)) {
    entryBody = entryBody.replace(
      new RegExp(
        `(?:export\\s+)?(?:default\\s+)?function\\s+${m.name}\\s*\\([\\s\\S]*?\\n\\}`,
        "g"
      ),
      `/* ${m.name} imported from ./${m.path.replace(/^src\//, "")} */`
    );
  }
  if (!/export\s+default/.test(entryBody)) {
    if (/(?:async\s+)?function\s+Component\s*\(/.test(entryBody)) {
      entryBody = promoteFunctionToDefaultExport(entryBody, "Component");
    } else {
      entryBody = entryBody.trimEnd() + "\n\nexport default Component;\n";
    }
  }

  const finalEntry =
    (preservedApp ? preservedApp + "\n" : "") +
    (imports ? imports + "\n\n" : "") +
    entryBody;
  const entryOut = entryPath.startsWith("src/") ? entryPath : "src/Component.tsx";
  out[entryOut] = finalEntry.endsWith("\n") ? finalEntry : finalEntry + "\n";

  // Ensure main entry is always Component.tsx for Vite main.tsx
  if (entryOut !== "src/Component.tsx" && !out["src/Component.tsx"]) {
    out["src/Component.tsx"] =
      `export { default } from "./${entryOut.replace(/^src\//, "").replace(/\.tsx?$/, "")}";\n`;
  }

  for (const filePath of Object.keys(out)) {
    if (!/\.(tsx?|jsx?)$/i.test(filePath) || isNextServerPath(filePath)) continue;
    out[filePath] = finalizeShipModule(filePath, out[filePath]);
  }

  return out;
}

/**
 * Convert studio multi-file sources into Next.js App Router modules under `components/`.
 * Same ES-module packaging as Vite; paths remapped for idiomatic Next layout.
 */
export function packageForNext(code: string): ProjectFiles {
  const vite = packageForVite(code);
  const out: ProjectFiles = {};

  for (const [path, content] of Object.entries(vite)) {
    if (path.startsWith("src/")) {
      const rest = path.slice("src/".length);
      // Keep non-component assets if any under src/
      if (/\.(tsx?|jsx?)$/i.test(rest)) {
        out[`components/${rest}`] = content;
      } else {
        out[path] = content;
      }
    } else if (/\.(tsx?|jsx?)$/i.test(path) && !path.includes("/")) {
      out[`components/${path}`] = content;
    } else {
      out[path] = content;
    }
  }

  // Guarantee components/Component.tsx for app/page.tsx
  if (!out["components/Component.tsx"]) {
    const first = Object.keys(out).find((p) => p.startsWith("components/") && /\.tsx?$/i.test(p));
    if (first) {
      const rel = "./" + first.replace(/^components\//, "").replace(/\.tsx?$/i, "");
      out["components/Component.tsx"] = `export { default } from "${rel}";\n`;
    }
  }

  // Fix relative imports inside components (still ./Hero style from packageForVite)
  // packageForVite already emits ./Hero from entry — stays valid under components/

  return out;
}

/**
 * Extract multi-file (or single) project from assistant stream text.
 * Supports:
 *   ```tsx file="src/Hero.tsx"
 *   ```tsx path="src/Hero.tsx"
 *   ```tsx src/Hero.tsx
 *   ```tsx
 *   (defaults to src/Component.tsx)
 */
export function extractProjectFromResponse(text: string): {
  summary: string;
  project: ProjectBundle;
  isMulti: boolean;
} {
  const fenceRe =
    /```(?:tsx?|jsx?)(?:\s+(?:file|path)=["']([^"']+)["']|\s+([^\n`]+))?\r?\n([\s\S]*?)```/gi;
  const files: ProjectFiles = {};
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    const rawPath = (match[1] || match[2] || "").trim();
    const body = match[3].trimEnd();
    const path = rawPath
      ? normalizePath(rawPath.replace(/^file=/i, "").replace(/^path=/i, "").replace(/["']/g, ""))
      : "src/Component.tsx";
    // If multiple unlabeled fences, only first is Component; rest get numbered names
    let finalPath = path;
    if (!rawPath && files["src/Component.tsx"] && body) {
      finalPath = `src/Part${Object.keys(files).length + 1}.tsx`;
    }
    if (body.trim()) files[finalPath] = body.trimEnd() + "\n";
  }

  // Incomplete open fence while streaming
  if (Object.keys(files).length === 0) {
    const open = text.match(/```(?:tsx?|jsx?)(?:\s+(?:file|path)=["']([^"']+)["']|\s+([^\n`]+))?\r?\n([\s\S]*)$/i);
    if (open) {
      const rawPath = (open[1] || open[2] || "").trim();
      const path = rawPath
        ? normalizePath(rawPath.replace(/^file=/i, "").replace(/^path=/i, "").replace(/["']/g, ""))
        : "src/Component.tsx";
      files[path] = open[3];
    }
  }

  if (Object.keys(files).length === 0) {
    return {
      summary: text.slice(0, 200),
      project: {
        v: 1,
        entry: "src/Component.tsx",
        files: { "src/Component.tsx": "" },
      },
      isMulti: false,
    };
  }

  // Prefer Component as entry
  let entry = "src/Component.tsx";
  if (!files[entry]) {
    const componentLike = Object.keys(files).find((p) =>
      /component|app|page|main/i.test(p)
    );
    entry = componentLike || Object.keys(files)[0];
  }

  const firstFence = text.search(/```(?:tsx?|jsx?)/i);
  const summary =
    firstFence > 0 ? text.slice(0, firstFence).trim() : "Generated UI";

  return {
    summary,
    project: { v: 1, entry, files },
    isMulti: Object.keys(files).length > 1,
  };
}

/** For streaming UI: extract whatever we can so far. */
export function extractStreamingProject(text: string): {
  code: string; // serializable storage form once complete enough, or entry code for preview
  entryCode: string;
  files: ProjectFiles;
  isComplete: boolean;
  isMulti: boolean;
  lineCount: number;
  charCount: number;
} {
  const { project, isMulti } = extractProjectFromResponse(text);
  const entryCode = project.files[project.entry] || "";
  const tickCount = (text.match(/```/g) || []).length;
  const fencesBalanced = tickCount >= 2 && tickCount % 2 === 0;
  const multi = isMulti || Object.keys(project.files).length > 1;
  const complete = fencesBalanced && Boolean(entryCode.trim());

  const allCode = Object.values(project.files).join("\n");
  const storage = multi
    ? serializeProject(project.files, project.entry)
    : entryCode;

  return {
    code: storage,
    entryCode,
    files: project.files,
    isComplete: complete,
    isMulti: multi,
    lineCount: allCode ? allCode.split("\n").length : 0,
    charCount: allCode.length,
  };
}
