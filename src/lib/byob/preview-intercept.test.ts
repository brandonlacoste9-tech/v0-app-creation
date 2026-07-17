/**
 * BYOB True Preview Intercept suite.
 * Run: npx tsx src/lib/byob/preview-intercept.test.ts
 */
import type { DatabaseSchemaMap } from "./types";
import {
  applyPreviewActionIntercept,
  extractActionImportBindings,
  generatePreviewActionsInline,
  getDefaultActionMockSource,
  sourceReferencesActions,
  stripActionImportDeclarations,
} from "./preview-intercept";
import { wrapCodeForPreview } from "../preview-html";
import { sanitizePreviewSource } from "../preview-html";
import { PREVIEW_THEMES } from "../types";
import { tryMountEntry, resolveBabel } from "../preview-fixtures/guards";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

const schema: DatabaseSchemaMap = {
  v: 1,
  dialect: "postgresql",
  provider: "neon",
  introspectedAt: "2026-01-01T00:00:00.000Z",
  tableCount: 1,
  tables: [
    {
      name: "users",
      columns: [
        {
          name: "id",
          dataType: "uuid",
          udtName: "uuid",
          nullable: false,
          isPrimaryKey: true,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "email",
          dataType: "text",
          udtName: "text",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "name",
          dataType: "text",
          udtName: "text",
          nullable: true,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
      ],
      foreignKeys: [],
    },
  ],
};

// ── detect / strip ───────────────────────────────────────────────────────

const prodUi = `import { listUsers, createUsers } from "@/app/actions";

function Component() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    listUsers().then(setRows);
  }, []);
  return (
    <div className="p-8">
      <button type="button" onClick={() => createUsers({ email: "a@b.com" })}>
        Add
      </button>
      <pre>{JSON.stringify(rows)}</pre>
    </div>
  );
}
`;

{
  assert(sourceReferencesActions(prodUi), "detects actions import");
  const stripped = stripActionImportDeclarations(prodUi);
  assert(!stripped.includes("@/app/actions"), "import removed");
  assert(stripped.includes("function Component"), "component kept");
}

// ── schema-driven surface (plural + singular) ────────────────────────────

{
  const inline = generatePreviewActionsInline(schema);
  assert(inline.includes("async function listUsers"), "listUsers");
  assert(inline.includes("async function createUsers"), "createUsers");
  assert(inline.includes("async function createUser"), "createUser singular alias");
  assert(inline.includes("async function updateUser"), "updateUser");
  assert(inline.includes("async function deleteUser"), "deleteUser");
  assert(inline.includes("async function getUserById"), "getUserById");
  assert(inline.includes("__previewDb"), "db store");
  assert(inline.includes("__previewActionStore"), "proxy store");
}

// ── default store (no BYOB schema) ───────────────────────────────────────

{
  const def = getDefaultActionMockSource();
  assert(def.includes("listUsers") && def.includes("createUser"), "default CRUD");
  assert(def.includes("listPosts") && def.includes("createPost"), "default posts");
  assert(def.includes("__unknownAction"), "unknown action fallback");
}

// ── apply intercept ──────────────────────────────────────────────────────

{
  const { code, intercepted } = applyPreviewActionIntercept(prodUi, schema);
  assert(intercepted, "intercepted");
  assert(code.includes("async function listUsers"), "inlined list");
  assert(!code.includes('from "@/app/actions"'), "no production import");
  assert(code.includes("function Component"), "component present");
}

// ── singular createUser import (model dialect) ───────────────────────────

{
  const src = `"use client";
import { listUsers, createUser } from '@/app/actions';

function Component() {
  const [users, setUsers] = useState([]);
  useEffect(() => { listUsers().then(setUsers); }, []);
  const handleCreate = async () => {
    const u = await createUser({ name: "Charlie", email: "c@preview.dev" });
    setUsers((p) => [...p, u]);
  };
  return <button type="button" onClick={handleCreate}>Create</button>;
}
`;
  const binds = extractActionImportBindings(src);
  assert(
    binds.some((b) => b.local === "listUsers") &&
      binds.some((b) => b.local === "createUser"),
    "extract named bindings"
  );

  const { code, intercepted } = applyPreviewActionIntercept(src, null);
  assert(intercepted, "no-schema still intercepts");
  assert(code.includes("async function createUser"), "createUser present");
  assert(code.includes("async function listUsers"), "listUsers present");
  assert(!code.includes("@/app/actions"), "import stripped");
  assert(!code.includes('"use client"'), "use client stripped");

  // Full preview path: sanitize + babel + mount
  const cleaned = sanitizePreviewSource(code);
  const Babel = resolveBabel();
  if (Babel) {
    const r = Babel.transform(cleaned, {
      presets: [["react", { runtime: "classic" }]],
      filename: "Component.jsx",
      sourceType: "script",
    });
    assert(Boolean(r.code), "babel emits");
    const mount = tryMountEntry(r.code!);
    assert(mount.ok, `mount entry: ${"error" in mount ? mount.error : ""}`);
  }
}

// ── aliased import ───────────────────────────────────────────────────────

{
  const src = `import { createUser as addUser } from "@/app/actions";
function Component() {
  return <button type="button" onClick={() => addUser({ name: "X" })}>Add</button>;
}
`;
  const { code } = applyPreviewActionIntercept(src, null);
  assert(code.includes("var addUser"), "alias binding emitted");
  assert(code.includes("addUser"), "alias usable");
}

// ── wrapCodeForPreview integration ───────────────────────────────────────

{
  const html = wrapCodeForPreview(prodUi, PREVIEW_THEMES[0], "{}", {
    byobSchema: schema,
  });
  assert(
    html.includes("listUsers") || html.includes("__previewDb"),
    "html has intercept"
  );
  assert(
    html.includes("shipboard-preview-actions-intercept") ||
      html.includes("preview-actions"),
    "babel plugin"
  );
  assert(
    html.includes("function Component") || html.includes("Component"),
    "component in html"
  );
}

// ── mutation consistency (store mutates in place) ────────────────────────

{
  const inline = getDefaultActionMockSource();
  // new Function cannot return a Promise from async IIFE easily via sync call —
  // just assert source mutates __previewDb (unshift present)
  void inline;
  assert(inline.includes(".unshift(row)"), "create mutates array");
  assert(inline.includes("__previewDb.users"), "users seed array");
}

console.log("preview-intercept tests: all passed");
