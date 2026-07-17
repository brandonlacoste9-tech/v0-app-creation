/**
 * True Preview Intercept — production Server Action imports → in-memory mocks.
 *
 * Contract (hybrid single-pass):
 *   Ship path keeps real `@/app/actions` + Drizzle.
 *   Preview gets a lossy but mountable projection (same call-site names).
 *   Never ask the model to write a preview dialect.
 *
 * Pipeline position: after mergeForPreview(), before sanitizePreviewSource().
 */
import type { DatabaseSchemaMap, SchemaTable } from "./types";
import { generateInitialMockStore } from "./mock-data-generator";

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
    s === "../app/actions" ||
    s.endsWith("/app/actions") ||
    /(^|\/)actions$/.test(s)
  );
}

export function sourceReferencesActions(source: string): boolean {
  if (ACTION_FROM_RE.test(source)) return true;
  if (/from\s+['"]@\/app\/actions['"]/.test(source)) return true;
  if (/from\s+['"]app\/actions['"]/.test(source)) return true;
  // Bare call sites after a previous intercept / multi-file merge
  if (
    /\b(listUsers|createUser|createUsers|updateUser|deleteUser|getUserById|listPosts|createPost)\s*\(/.test(
      source
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Named bindings pulled from action imports.
 *   import { listUsers, createUser as add } from "@/app/actions"
 *   → ["listUsers", "add"]  (local names)
 */
export function extractActionImportBindings(
  source: string
): { local: string; exported: string }[] {
  const bindings: { local: string; exported: string }[] = [];
  const re =
    /import\s+(?:type\s+)?(?:(\w+)\s*,\s*)?\{([^}]*)\}\s*from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const spec = m[3];
    if (!isActionsModuleSpecifier(spec)) continue;
    if (m[1]) {
      // default import — rare for actions; bind as local name
      bindings.push({ local: m[1], exported: "default" });
    }
    const inner = m[2];
    for (const part of inner.split(",")) {
      const bit = part.trim();
      if (!bit || bit === "type") continue;
      // skip pure type imports inside: `type Foo`
      if (/^type\s+/.test(bit)) continue;
      const asMatch = bit.match(
        /^(?:type\s+)?([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/
      );
      if (asMatch) {
        bindings.push({ exported: asMatch[1], local: asMatch[2] });
        continue;
      }
      const id = bit.replace(/^type\s+/, "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(id)) {
        bindings.push({ exported: id, local: id });
      }
    }
  }
  // import * as actions from "@/app/actions"
  const ns =
    /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = ns.exec(source)) !== null) {
    if (isActionsModuleSpecifier(m[2])) {
      bindings.push({ local: m[1], exported: "*" });
    }
  }
  return bindings;
}

function toPascal(name: string): string {
  const c = name.replace(/_([a-z])/g, (_, x: string) => x.toUpperCase());
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function toSingularPascal(tableName: string): string {
  const p = toPascal(tableName);
  if (/ies$/i.test(p) && p.length > 3) return p.slice(0, -3) + "y";
  if (/ses$/i.test(p) && p.length > 3) return p.slice(0, -2);
  if (/s$/i.test(p) && p.length > 1 && !/ss$/i.test(p)) return p.slice(0, -1);
  return p;
}

function pkName(t: SchemaTable): string {
  const pk = t.columns.find((c) => c.isPrimaryKey) || t.columns[0];
  return pk?.name || "id";
}

/**
 * Opinionated default store when BYOB schema is not connected but the UI
 * still imports @/app/actions (common during early gens / templates).
 */
export function getDefaultActionMockSource(): string {
  return `/* ── Shipboard Preview Intercept: default users+posts store ── */
var __previewDb = {
  users: [
    { id: "u1", name: "Ada Lovelace", email: "ada@preview.dev", role: "admin" },
    { id: "u2", name: "Grace Hopper", email: "grace@preview.dev", role: "member" }
  ],
  posts: [
    { id: "p1", title: "Hello Shipboard", body: "Preview intercept in action.", userId: "u1" },
    { id: "p2", title: "Hybrid single-pass", body: "Production dialect, browser projection.", userId: "u2" }
  ]
};
function __unknownAction(name) {
  return async function() {
    try { console.warn("[Shipboard preview] unknown action:", name); } catch(_){}
    return null;
  };
}
async function listUsers(limit) {
  limit = Math.min(Math.max(limit == null ? 50 : Number(limit) || 50, 1), 200);
  return (__previewDb.users || []).slice(0, limit);
}
async function getUserById(id) {
  var rows = __previewDb.users || [];
  for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i];
  return null;
}
async function createUser(input) {
  var row = Object.assign({ id: "u-" + Date.now(), name: "New User", email: "new@preview.dev", role: "member" }, input || {});
  if (!__previewDb.users) __previewDb.users = [];
  __previewDb.users.unshift(row);
  return row;
}
async function createUsers(input) { return createUser(input); }
async function updateUser(id, input) {
  var rows = __previewDb.users || [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) {
      rows[i] = Object.assign({}, rows[i], input || {}, { id: rows[i].id });
      return rows[i];
    }
  }
  return null;
}
async function updateUsers(id, input) { return updateUser(id, input); }
async function deleteUser(id) {
  __previewDb.users = (__previewDb.users || []).filter(function(r) { return String(r.id) !== String(id); });
  return { ok: true, id: id };
}
async function deleteUsers(id) { return deleteUser(id); }
async function listPosts(limit) {
  limit = Math.min(Math.max(limit == null ? 50 : Number(limit) || 50, 1), 200);
  return (__previewDb.posts || []).slice(0, limit);
}
async function createPost(input) {
  var row = Object.assign({ id: "p-" + Date.now(), title: "Untitled", body: "", userId: "u1" }, input || {});
  if (!__previewDb.posts) __previewDb.posts = [];
  __previewDb.posts.unshift(row);
  return row;
}
async function createPosts(input) { return createPost(input); }
async function listTables() { return ["users", "posts"]; }
var __previewActionStore = new Proxy({
  listUsers: listUsers, createUser: createUser, createUsers: createUsers,
  updateUser: updateUser, updateUsers: updateUsers,
  deleteUser: deleteUser, deleteUsers: deleteUsers,
  getUserById: getUserById, listPosts: listPosts,
  createPost: createPost, createPosts: createPosts, listTables: listTables
}, {
  get: function(t, prop) {
    if (prop in t) return t[prop];
    if (prop === "__esModule") return true;
    return __unknownAction(String(prop));
  }
});
`;
}

/**
 * Schema-driven inline actions (same names the Drizzle codegen emits).
 * Also emits singular aliases so model invents of createUser vs createUsers both work.
 */
export function generatePreviewActionsInline(schema: DatabaseSchemaMap): string {
  if (!schema.tables.length) {
    return getDefaultActionMockSource();
  }

  // Schema-aware seeds: names, emails, FKs, dates (see mock-data-generator.ts)
  const seeds = generateInitialMockStore(schema, {
    rowsPerTable: 5,
    // Stable-ish within a minute so re-renders don't thrash; tests pass explicit seed
    seed: Math.floor(Date.now() / 60_000) ^ (schema.tableCount * 7919),
  });

  const fns: string[] = [];
  const storeEntries: string[] = [];

  for (const t of schema.tables) {
    const p = toPascal(t.name); // Users
    const s = toSingularPascal(t.name); // User
    const pk = pkName(t);
    const pkLit = JSON.stringify(pk);
    const tableLit = JSON.stringify(t.name);

    fns.push(`
async function list${p}(limit) {
  limit = Math.min(Math.max(limit == null ? 50 : Number(limit) || 50, 1), 200);
  return (__previewDb[${tableLit}] || []).slice(0, limit);
}
async function get${p}ById(id) {
  var rows = __previewDb[${tableLit}] || [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][${pkLit}]) === String(id)) return rows[i];
  }
  return null;
}
async function get${s}ById(id) { return get${p}ById(id); }
async function get${p}WithRelations(id) { return get${p}ById(id); }
async function create${p}(input) {
  var row = Object.assign({}, input || {});
  if (row[${pkLit}] == null) {
    row[${pkLit}] = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : ("local-" + Date.now());
  }
  if (!__previewDb[${tableLit}]) __previewDb[${tableLit}] = [];
  __previewDb[${tableLit}].unshift(row);
  return row;
}
async function create${s}(input) { return create${p}(input); }
async function update${p}(id, input) {
  var rows = __previewDb[${tableLit}] || [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][${pkLit}]) === String(id)) {
      var keep = {}; keep[${pkLit}] = rows[i][${pkLit}];
      rows[i] = Object.assign({}, rows[i], input || {}, keep);
      return rows[i];
    }
  }
  return null;
}
async function update${s}(id, input) { return update${p}(id, input); }
async function delete${p}(id) {
  var rows = __previewDb[${tableLit}] || [];
  __previewDb[${tableLit}] = rows.filter(function(r) {
    return String(r[${pkLit}]) !== String(id);
  });
  return { ok: true, id: id };
}
async function delete${s}(id) { return delete${p}(id); }`);

    storeEntries.push(
      `list${p}: list${p}`,
      `create${p}: create${p}`,
      `create${s}: create${s}`,
      `update${p}: update${p}`,
      `update${s}: update${s}`,
      `delete${p}: delete${p}`,
      `delete${s}: delete${s}`,
      `get${p}ById: get${p}ById`,
      `get${s}ById: get${s}ById`
    );
  }

  return `/* ── Shipboard Preview Intercept: schema mock data (${schema.tableCount} tables) ── */
/* Seeded from your introspected columns/FKs — not production data */
var __previewDb = ${JSON.stringify(seeds)};
function __unknownAction(name) {
  return async function() {
    try { console.warn("[Shipboard preview] unknown action:", name); } catch(_){}
    return null;
  };
}
${fns.join("\n")}
async function listTables() {
  return ${JSON.stringify(schema.tables.map((t) => t.name))};
}
var __previewActionStore = new Proxy({
  ${storeEntries.join(",\n  ")},
  listTables: listTables
}, {
  get: function(t, prop) {
    if (prop in t) return t[prop];
    if (prop === "__esModule") return true;
    return __unknownAction(String(prop));
  }
});
`;
}

/**
 * Remove Server Action import lines (replaced by inlined functions).
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
    )
    .replace(/["']use client["'];?\s*/g, "");
}

/**
 * Bind imported local names so inventively-aliased imports work:
 *   import { createUser as addUser } from "@/app/actions"
 *   → var addUser = createUser  (or store lookup)
 * Same-name imports (listUsers) are already function declarations — skip.
 */
export function emitActionBindings(
  bindings: { local: string; exported: string }[]
): string {
  if (!bindings.length) return "";
  const lines: string[] = ["/* action name bindings */"];
  for (const b of bindings) {
    if (b.exported === "*" || b.exported === "default") {
      lines.push(`var ${b.local} = __previewActionStore;`);
      continue;
    }
    if (b.local === b.exported) {
      // function listUsers() already in scope from inline store
      continue;
    }
    lines.push(
      `var ${b.local} = (typeof ${b.exported} === "function" ? ${b.exported} : __previewActionStore[${JSON.stringify(b.exported)}]);`
    );
  }
  return lines.length > 1 ? lines.join("\n") + "\n" : "";
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
  const bindings = extractActionImportBindings(source);

  if (!refs && bindings.length === 0) {
    return { code: source, intercepted: false };
  }

  const stripped = stripActionImportDeclarations(source);
  const inline =
    schema?.tables?.length
      ? generatePreviewActionsInline(schema)
      : getDefaultActionMockSource();
  const binds = emitActionBindings(bindings);

  return {
    code: inline + "\n" + binds + "\n" + stripped,
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
          s === "../actions" ||
          s === "../app/actions" ||
          /\\/app\\/actions$/.test(s) ||
          s === "@/lib/db/preview-store" ||
          /preview-store$/.test(s)
        ) {
          path.remove();
        }
      }
    }
  };
}`;
}
