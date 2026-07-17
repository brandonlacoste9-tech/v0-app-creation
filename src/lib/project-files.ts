/**
 * Multi-file project bundle for Shipboard.
 * Stored as either plain TSX (legacy) or a JSON envelope in the version `code` field.
 */

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
  if (!/\.(tsx?|jsx?|css|json|md)$/i.test(p)) p = `${p}.tsx`;
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
 * Merge all TS/JS files into one script for iframe preview (no module system).
 * Non-entry files first so helpers/components exist before Component.
 */
export function mergeForPreview(code: string): string {
  const project = parseProject(code);
  const paths = Object.keys(project.files);
  const others = paths.filter((p) => p !== project.entry && /\.(tsx?|jsx?)$/i.test(p));
  const parts: string[] = [];

  for (const p of others) {
    parts.push(`/* --- ${p} --- */\n${stripModuleSyntax(project.files[p])}`);
  }
  const entry = project.files[project.entry] || "";
  parts.push(`/* --- ${project.entry} --- */\n${stripModuleSyntax(entry)}`);
  return parts.join("\n\n");
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
    let body = stripModuleSyntax(project.files[entry] || code);
    if (!/export\s+default/.test(body)) {
      body = body.trimEnd() + "\n\nexport default Component;\n";
    }
    out[entry.startsWith("src/") ? entry : "src/Component.tsx"] = body.endsWith("\n")
      ? body
      : body + "\n";
    return out;
  }

  const entryPath = project.files[project.entry]
    ? project.entry
    : tsPaths.find((p) => /component/i.test(p)) || tsPaths[0];

  const modules: { path: string; name: string; body: string }[] = [];

  for (const path of tsPaths) {
    const raw = project.files[path] || "";
    // Preserve @/app/actions + @/lib/* for Next ship (true production imports)
    let body = stripModuleSyntax(raw, { preserveAppImports: true });
    const name =
      firstCapitalFunction(body) || pathToExportName(path);
    const isEntry = path === entryPath;

    if (!isEntry) {
      // Prefer export default function Name
      if (new RegExp(`function\\s+${name}\\s*\\(`).test(body)) {
        body = body.replace(
          new RegExp(`function\\s+${name}\\s*\\(`),
          `export default function ${name}(`
        );
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
    if (/function\s+Component\s*\(/.test(entryBody)) {
      entryBody = entryBody.replace(
        /function\s+Component\s*\(/,
        "export default function Component("
      );
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
  let lastIndex = 0;

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
    lastIndex = match.index + match[0].length;
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
