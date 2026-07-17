/**
 * True Preview Intercept — rewrite production Server Action imports to
 * in-memory implementations for the studio iframe (no LLM dual-path).
 *
 * Production code:  import { createUsers } from "@/app/actions"
 * Preview transpile: same names, functions backed by preview mocks.
 */
import type { DatabaseSchemaMap, SchemaTable } from "./types";

const ACTION_FROM_RE =
  /from\s+['"](?:@\/)?(?:\.\/|\.\.\/)*(?:app\/)?actions(?:\.ts)?['"]/;

/** Paths the LLM / ship code may use for Server Actions */
export function isActionsModuleSpecifier(spec: string): boolean {
  const s = spec.replace(/\\/g, "/").replace(/\.tsx?$/, "");
  return (
    s === "@/app/actions" ||
    s === "app/actions" ||
    s === "./actions" ||
    s === "../actions" ||
    s.endsWith("/app/actions") ||
    /(^|\/)actions$/.test(s)
  );
}

export function sourceReferencesActions(source: string): boolean {
  return (
    ACTION_FROM_RE.test(source) ||
    /from\s+['"]@\/app\/actions['"]/.test(source) ||
    /from\s+['"]app\/actions['"]/.test(source)
  );
}

function toPascal(name: string): string {
  const c = name.replace(/_([a-z])/g, (_, x: string) => x.toUpperCase());
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function toCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function pkName(t: SchemaTable): string {
  const pk = t.columns.find((c) => c.isPrimaryKey) || t.columns[0];
  return pk?.name || "id";
}

function sampleRow(t: SchemaTable, n = 1): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const c of t.columns) {
    const k = c.name;
    if (c.isPrimaryKey && c.dataType === "uuid") {
      row[k] = `00000000-0000-4000-8000-00000000000${n}`;
    } else if (c.isPrimaryKey) {
      row[k] = n;
    } else {
      switch (c.dataType) {
        case "boolean":
          row[k] = n % 2 === 0;
          break;
        case "integer":
        case "bigint":
        case "numeric":
        case "real":
        case "double":
          row[k] = n * 10;
          break;
        case "timestamptz":
        case "timestamp":
        case "date":
          row[k] = new Date().toISOString();
          break;
        case "json":
        case "jsonb":
          row[k] = { demo: true, n };
          break;
        default:
          row[k] = `${t.name}_${k}_${n}`;
      }
    }
  }
  return row;
}

/**
 * Inline IIFE / function declarations for the iframe bundle (no ESM).
 * Same surface as app/actions.ts so call sites need zero changes.
 */
export function generatePreviewActionsInline(schema: DatabaseSchemaMap): string {
  if (!schema.tables.length) {
    return `/* preview intercept: no tables */\nasync function listTables() { return []; }\n`;
  }

  const seeds: Record<string, Record<string, unknown>[]> = {};
  for (const t of schema.tables) {
    seeds[t.name] = [sampleRow(t, 1), sampleRow(t, 2)];
  }

  const fns: string[] = [];
  for (const t of schema.tables) {
    const p = toPascal(t.name);
    const pk = pkName(t);
    fns.push(`
async function list${p}(limit) {
  limit = Math.min(Math.max(limit == null ? 50 : limit, 1), 200);
  return (__previewDb["${t.name}"] || []).slice(0, limit);
}
async function get${p}ById(id) {
  var rows = __previewDb["${t.name}"] || [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][${JSON.stringify(pk)}]) === String(id)) return rows[i];
  }
  return null;
}
async function get${p}WithRelations(id) {
  return get${p}ById(id);
}
async function create${p}(input) {
  var row = Object.assign({}, input || {});
  if (row[${JSON.stringify(pk)}] == null) {
    row[${JSON.stringify(pk)}] = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : ("local-" + Date.now());
  }
  if (!__previewDb["${t.name}"]) __previewDb["${t.name}"] = [];
  __previewDb["${t.name}"].unshift(row);
  return row;
}
async function update${p}(id, input) {
  var rows = __previewDb["${t.name}"] || [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][${JSON.stringify(pk)}]) === String(id)) {
      rows[i] = Object.assign({}, rows[i], input || {}, (function(){ var o={}; o[${JSON.stringify(pk)}]=rows[i][${JSON.stringify(pk)}]; return o; })());
      return rows[i];
    }
  }
  return null;
}
async function delete${p}(id) {
  var rows = __previewDb["${t.name}"] || [];
  __previewDb["${t.name}"] = rows.filter(function(r) {
    return String(r[${JSON.stringify(pk)}]) !== String(id);
  });
  return { ok: true, id: id };
}`);
  }

  return `/* ── Shipboard Preview Intercept: @/app/actions → in-memory ── */
var __previewDb = ${JSON.stringify(seeds)};
${fns.join("\n")}
async function listTables() {
  return ${JSON.stringify(schema.tables.map((t) => t.name))};
}
`;
}

/**
 * Remove Server Action import lines (they are replaced by inlined functions).
 * Does not touch other imports (still stripped later by sanitize).
 */
export function stripActionImportDeclarations(source: string): string {
  return source
    .replace(
      /import\s+type\s+[\s\S]*?from\s+['"][^'"]*actions(?:\.ts)?['"]\s*;?\s*/g,
      ""
    )
    .replace(
      /import\s+[\s\S]*?from\s+['"](?:@\/)?(?:\.\/|\.\.\/)*(?:app\/)?actions(?:\.ts)?['"]\s*;?\s*/g,
      ""
    )
    .replace(
      /import\s+[\s\S]*?from\s+['"]@\/app\/actions['"]\s*;?\s*/g,
      ""
    );
}

/**
 * Apply intercept: strip action imports + prepend in-memory action surface.
 * Call BEFORE general import stripping / sanitize.
 */
export function applyPreviewActionIntercept(
  source: string,
  schema: DatabaseSchemaMap | null | undefined
): { code: string; intercepted: boolean } {
  const refs = sourceReferencesActions(source);
  if (!schema?.tables?.length) {
    if (!refs) return { code: source, intercepted: false };
    // Import present but no schema — soft stubs so Babel doesn't leave undefined
    const stripped = stripActionImportDeclarations(source);
    const stub = `/* preview intercept stubs (no BYOB schema) */\nasync function listTables(){return [];}\n`;
    return { code: stub + "\n" + stripped, intercepted: true };
  }

  if (!refs && !source.includes("list") && !source.includes("create")) {
    // Still inject if schema connected so Component can call actions without import
    // Only inject when references actions to keep bundle small
    return { code: source, intercepted: false };
  }

  if (!refs) {
    return { code: source, intercepted: false };
  }

  const stripped = stripActionImportDeclarations(source);
  const inline = generatePreviewActionsInline(schema);
  return {
    code: inline + "\n" + stripped,
    intercepted: true,
  };
}

/**
 * Babel visitor source for iframe — removes leftover action imports after rewrite.
 * Injected as a function expression string into wrapCodeForPreview.
 */
export function getPreviewInterceptBabelPluginSource(): string {
  return `function(babel) {
  var t = babel.types;
  return {
    name: "shipboard-preview-actions-intercept",
    visitor: {
      ImportDeclaration: function(path) {
        var src = path.node.source && path.node.source.value;
        if (!src || typeof src !== "string") return;
        var s = src.replace(/\\\\/g, "/").replace(/\\.tsx?$/, "");
        if (
          s === "@/app/actions" ||
          s === "app/actions" ||
          s === "./actions" ||
          s === "../app/actions" ||
          /\\/app\\/actions$/.test(s) ||
          s === "@/lib/db/preview-store" ||
          /preview-store$/.test(s)
        ) {
          // Named imports become no-ops — functions already inlined in scope
          path.remove();
        }
      }
    }
  };
}`;
}
