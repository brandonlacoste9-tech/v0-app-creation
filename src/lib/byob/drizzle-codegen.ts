/**
 * Deterministic Drizzle + Server Actions codegen from a schema map.
 * Prefer this over LLM-authored schema.ts (no hallucinated tables/columns).
 *
 * Emits:
 * - pgTable definitions
 * - drizzle-zod insert/select schemas (mutations)
 * - relations() for Relational Query API
 * - CRUD Server Actions with Zod parse
 * - preview mocks + in-memory preview store (studio / local UI)
 */
import type { DatabaseSchemaMap, PgDataType, SchemaColumn, SchemaTable } from "./types";

function toCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toPascal(name: string): string {
  const c = toCamel(name);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function singularize(name: string): string {
  if (name.endsWith("ies") && name.length > 3) return name.slice(0, -3) + "y";
  if (name.endsWith("sses")) return name.slice(0, -2);
  if (name.endsWith("s") && !name.endsWith("ss") && name.length > 1) {
    return name.slice(0, -1);
  }
  return name;
}

function tableExportName(table: SchemaTable | string): string {
  const name = typeof table === "string" ? table : table.name;
  return toCamel(name);
}

function pkColumn(t: SchemaTable): SchemaColumn | undefined {
  return t.columns.find((c) => c.isPrimaryKey) || t.columns[0];
}

function drizzleCol(col: SchemaColumn): string {
  const n = col.name;

  const typeExpr = (t: PgDataType): string => {
    switch (t) {
      case "uuid":
        return `uuid("${n}")`;
      case "text":
        return `text("${n}")`;
      case "varchar":
        return col.maxLength
          ? `varchar("${n}", { length: ${col.maxLength} })`
          : `varchar("${n}")`;
      case "integer":
        return `integer("${n}")`;
      case "bigint":
        return `bigint("${n}", { mode: "number" })`;
      case "boolean":
        return `boolean("${n}")`;
      case "numeric":
        return `numeric("${n}")`;
      case "real":
        return `real("${n}")`;
      case "double":
        return `doublePrecision("${n}")`;
      case "timestamp":
        return `timestamp("${n}")`;
      case "timestamptz":
        return `timestamp("${n}", { withTimezone: true })`;
      case "date":
        return `date("${n}")`;
      case "json":
      case "jsonb":
        return `jsonb("${n}")`;
      default:
        return `text("${n}")`;
    }
  };

  let expr = typeExpr(col.dataType);
  if (col.isPrimaryKey) {
    if (col.dataType === "uuid") {
      expr += ".defaultRandom().primaryKey()";
    } else {
      expr += ".primaryKey()";
    }
  } else {
    if (!col.nullable) expr += ".notNull()";
    if (col.defaultValue && /now\(\)|CURRENT_TIMESTAMP/i.test(col.defaultValue)) {
      if (col.dataType === "timestamptz" || col.dataType === "timestamp") {
        expr += ".defaultNow()";
      }
    }
  }

  return `    ${toCamel(n)}: ${expr},`;
}

/** Relation graph from FKs for Drizzle relations() */
interface RelEdge {
  /** table that holds the FK column */
  fromTable: string;
  fromColumn: string;
  /** referenced table */
  toTable: string;
  toColumn: string;
}

function collectEdges(schema: DatabaseSchemaMap): RelEdge[] {
  const edges: RelEdge[] = [];
  for (const t of schema.tables) {
    for (const fk of t.foreignKeys) {
      edges.push({
        fromTable: t.name,
        fromColumn: fk.column,
        toTable: fk.refTable,
        toColumn: fk.refColumn,
      });
    }
  }
  return edges;
}

/**
 * Build relations() blocks.
 * - many-side (parent): many(childTable) named by child table export
 * - one-side (child with FK): one(parent, { fields, references })
 */
export function generateRelationsBlock(schema: DatabaseSchemaMap): string {
  const edges = collectEdges(schema);
  if (!edges.length) {
    return `// No foreign keys detected — Relational Query API "with" is empty.\n`;
  }

  const tableNames = new Set(schema.tables.map((t) => t.name));
  const manyByParent = new Map<string, { child: string; field: string }[]>();
  const oneByChild = new Map<
    string,
    { parent: string; field: string; fromCol: string; toCol: string }[]
  >();

  for (const e of edges) {
    if (!tableNames.has(e.fromTable) || !tableNames.has(e.toTable)) continue;

    // child → one parent
    const oneField =
      // user_id → user; author_id → author
      e.fromColumn.endsWith("_id")
        ? toCamel(e.fromColumn.replace(/_id$/, ""))
        : toCamel(singularize(e.toTable));
    const ones = oneByChild.get(e.fromTable) || [];
    ones.push({
      parent: e.toTable,
      field: oneField,
      fromCol: toCamel(e.fromColumn),
      toCol: toCamel(e.toColumn),
    });
    oneByChild.set(e.fromTable, ones);

    // parent → many children
    const manyField = tableExportName(e.fromTable);
    const manys = manyByParent.get(e.toTable) || [];
    // avoid duplicate many fields
    if (!manys.some((m) => m.child === e.fromTable && m.field === manyField)) {
      manys.push({ child: e.fromTable, field: manyField });
    }
    manyByParent.set(e.toTable, manys);
  }

  const blocks: string[] = [];
  for (const t of schema.tables) {
    const exp = tableExportName(t);
    const manys = manyByParent.get(t.name) || [];
    const ones = oneByChild.get(t.name) || [];
    if (!manys.length && !ones.length) continue;

    const needsMany = manys.length > 0;
    const needsOne = ones.length > 0;
    const destructure = [
      needsOne ? "one" : null,
      needsMany ? "many" : null,
    ]
      .filter(Boolean)
      .join(", ");

    const fields: string[] = [];
    for (const m of manys) {
      fields.push(`    ${m.field}: many(${tableExportName(m.child)}),`);
    }
    for (const o of ones) {
      fields.push(
        `    ${o.field}: one(${tableExportName(o.parent)}, {\n` +
          `      fields: [${exp}.${o.fromCol}],\n` +
          `      references: [${tableExportName(o.parent)}.${o.toCol}],\n` +
          `    }),`
      );
    }

    blocks.push(
      `export const ${exp}Relations = relations(${exp}, ({ ${destructure} }) => ({\n` +
        fields.join("\n") +
        `\n}));\n`
    );
  }

  if (!blocks.length) return "";
  return (
    `// ── Relations (for db.query.*.findMany({ with: … })) ──\n` +
    blocks.join("\n")
  );
}

/** Zod schema exports per table */
export function generateZodSchemasBlock(schema: DatabaseSchemaMap): string {
  if (!schema.tables.length) return "";

  const lines: string[] = [
    `// ── Zod validators (drizzle-zod) — use in Server Actions ──`,
  ];

  for (const t of schema.tables) {
    const exp = tableExportName(t);
    const pascal = toPascal(t.name);
    const pk = pkColumn(t);
    const pkCamel = pk ? toCamel(pk.name) : null;
    const hasDefaultPk =
      pk &&
      (pk.dataType === "uuid" ||
        (pk.defaultValue && /nextval|gen_random|uuid/i.test(pk.defaultValue)));

    lines.push(
      `export const insert${pascal}Schema = createInsertSchema(${exp})${
        hasDefaultPk && pkCamel
          ? `.omit({ ${pkCamel}: true })`
          : ""
      };`
    );
    lines.push(
      `export const select${pascal}Schema = createSelectSchema(${exp});`
    );
    lines.push(
      `export const update${pascal}Schema = createInsertSchema(${exp}).partial();`
    );
    lines.push(
      `export type Insert${pascal} = z.infer<typeof insert${pascal}Schema>;`
    );
    lines.push(
      `export type Select${pascal} = z.infer<typeof select${pascal}Schema>;`
    );
    lines.push("");
  }

  return lines.join("\n");
}

/** lib/db/schema.ts */
export function generateDrizzleSchemaTs(schema: DatabaseSchemaMap): string {
  const imports = new Set<string>(["pgTable"]);
  for (const t of schema.tables) {
    for (const c of t.columns) {
      switch (c.dataType) {
        case "uuid":
          imports.add("uuid");
          break;
        case "text":
          imports.add("text");
          break;
        case "varchar":
          imports.add("varchar");
          break;
        case "integer":
          imports.add("integer");
          break;
        case "bigint":
          imports.add("bigint");
          break;
        case "boolean":
          imports.add("boolean");
          break;
        case "numeric":
          imports.add("numeric");
          break;
        case "real":
          imports.add("real");
          break;
        case "double":
          imports.add("doublePrecision");
          break;
        case "timestamp":
        case "timestamptz":
          imports.add("timestamp");
          break;
        case "date":
          imports.add("date");
          break;
        case "json":
        case "jsonb":
          imports.add("jsonb");
          break;
        default:
          imports.add("text");
      }
    }
  }

  const hasRelations = collectEdges(schema).length > 0;
  const importLine = `import { ${[...imports].sort().join(", ")} } from "drizzle-orm/pg-core";\n`;
  const relationsImport = hasRelations
    ? `import { relations } from "drizzle-orm";\n`
    : "";
  const zodImport = schema.tables.length
    ? `import { createInsertSchema, createSelectSchema } from "drizzle-zod";\nimport { z } from "zod";\n`
    : "";

  const tables = schema.tables.map((t) => {
    const cols = t.columns.map(drizzleCol).join("\n");
    const exp = tableExportName(t);
    return `/** Table: public.${t.name} */\nexport const ${exp} = pgTable("${t.name}", {\n${cols}\n});\n`;
  });

  const relationsBlock = generateRelationsBlock(schema);
  const zodBlock = generateZodSchemasBlock(schema);

  return (
    `/**\n * Drizzle schema — generated by Shipboard from your Postgres introspection.\n` +
    ` * Provider: ${schema.provider} · ${schema.tableCount} table(s) · ${schema.introspectedAt}\n` +
    ` * Includes: tables, relations(), drizzle-zod validators.\n` +
    ` * Do not hand-edit blindly; re-introspect in Shipboard or adjust migrations intentionally.\n */\n` +
    importLine +
    relationsImport +
    zodImport +
    `\n` +
    (tables.length
      ? tables.join("\n")
      : `// No public tables found during introspection.\n`) +
    (relationsBlock ? `\n${relationsBlock}` : "") +
    (zodBlock ? `\n${zodBlock}` : "")
  );
}

/** lib/db/index.ts — schema object enables db.query relational API */
export function generateDbClientTs(): string {
  return `import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Server-only DB client (Neon HTTP + Drizzle).
 * Requires DATABASE_URL in the environment.
 *
 * Relational queries (when relations() are defined):
 *   const db = getDb();
 *   await db.query.users.findFirst({ with: { posts: true } });
 */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example → .env.local and paste your Neon/Supabase connection string."
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
`;
}

/** Prefer relational findFirst when table has relations */
function manyRelationFields(schema: DatabaseSchemaMap, tableName: string): string[] {
  const edges = collectEdges(schema);
  const fields: string[] = [];
  for (const e of edges) {
    if (e.toTable === tableName) {
      fields.push(tableExportName(e.fromTable));
    }
  }
  return [...new Set(fields)];
}

/** app/actions.ts — list/get/create/update/delete + optional relational get */
export function generateServerActionsTs(schema: DatabaseSchemaMap): string {
  if (!schema.tables.length) {
    return `"use server";

/** No tables introspected — add tables in Postgres and re-export from Shipboard. */
export async function healthCheck() {
  return { ok: true as const, tables: [] as string[] };
}
`;
  }

  const tableImports = schema.tables.map((t) => tableExportName(t)).join(", ");
  const zodImports = schema.tables
    .flatMap((t) => {
      const p = toPascal(t.name);
      return [`insert${p}Schema`, `update${p}Schema`];
    })
    .join(", ");

  const actions: string[] = [];

  for (const t of schema.tables) {
    const exp = tableExportName(t);
    const pascal = toPascal(t.name);
    const pk = pkColumn(t);
    const pkField = pk ? toCamel(pk.name) : "id";
    const withFields = manyRelationFields(schema, t.name);
    const withObj =
      withFields.length > 0
        ? `{ ${withFields.map((f) => `${f}: true`).join(", ")} }`
        : null;

    actions.push(`
// ── public.${t.name} ─────────────────────────────────────────

/** List rows from public.${t.name} */
export async function list${pascal}(limit = 50) {
  const db = getDb();
  const rows = await db.select().from(${exp}).limit(Math.min(Math.max(limit, 1), 200));
  return rows;
}

/** Get one row from public.${t.name} by primary key */
export async function get${pascal}ById(id: string | number) {
  const db = getDb();
  const rows = await db.select().from(${exp}).where(eq(${exp}.${pkField}, id as never)).limit(1);
  return rows[0] ?? null;
}
${
  withObj
    ? `
/** Relational: public.${t.name} + nested children (db.query) */
export async function get${pascal}WithRelations(id: string | number) {
  const db = getDb();
  return (db.query as Record<string, { findFirst: (args: unknown) => Promise<unknown> }>).${exp}.findFirst({
    where: eq(${exp}.${pkField}, id as never),
    with: ${withObj},
  });
}
`
    : ""
}
/** Create row — input validated with insert${pascal}Schema */
export async function create${pascal}(input: unknown) {
  const data = insert${pascal}Schema.parse(input);
  const db = getDb();
  const rows = await db.insert(${exp}).values(data as never).returning();
  return rows[0];
}

/** Update row — partial input via update${pascal}Schema */
export async function update${pascal}(id: string | number, input: unknown) {
  const data = update${pascal}Schema.parse(input);
  const db = getDb();
  const rows = await db
    .update(${exp})
    .set(data as never)
    .where(eq(${exp}.${pkField}, id as never))
    .returning();
  return rows[0] ?? null;
}

/** Delete row by primary key */
export async function delete${pascal}(id: string | number) {
  const db = getDb();
  await db.delete(${exp}).where(eq(${exp}.${pkField}, id as never));
  return { ok: true as const, id };
}
`);
  }

  return `"use server";

/**
 * Next.js Server Actions — generated by Shipboard BYOB.
 * Mutations always parse through drizzle-zod schemas from lib/db/schema.ts.
 * Prefer Relational Query helpers (*WithRelations) over hand-written joins.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  ${tableImports},
  ${zodImports},
} from "@/lib/db/schema";
${actions.join("\n")}
export async function listTables() {
  return ${JSON.stringify(schema.tables.map((t) => t.name))} as const;
}
`;
}

/** Sample seed rows for preview / docs */
export function generatePreviewMocksTs(schema: DatabaseSchemaMap): string {
  const samples: Record<string, Record<string, unknown>[]> = {};
  for (const t of schema.tables) {
    samples[t.name] = [sampleRow(t), sampleRow(t, 2)];
  }
  return `/**
 * Preview / Storybook-style mock rows shaped like your Drizzle tables.
 * Studio iframe cannot hit Postgres — use these seeds or lib/db/preview-store.
 */
export const PREVIEW_DB_MOCKS = ${JSON.stringify(samples, null, 2)} as const;

export type PreviewTableName = keyof typeof PREVIEW_DB_MOCKS;

export function previewRows(table: string): Record<string, unknown>[] {
  const key = table as PreviewTableName;
  return (PREVIEW_DB_MOCKS[key] as Record<string, unknown>[] | undefined) ?? [];
}
`;
}

/**
 * Client-side in-memory store that mirrors Server Action names.
 * Ship UI can swap: preview-store in studio / tests → real actions in production.
 */
export function generatePreviewStoreTs(schema: DatabaseSchemaMap): string {
  const tableNames = schema.tables.map((t) => t.name);
  const methods: string[] = [];

  for (const t of schema.tables) {
    const pascal = toPascal(t.name);
    const pk = pkColumn(t);
    const pkName = pk?.name || "id";

    methods.push(`
  async list${pascal}(limit = 50) {
    return this._all("${t.name}").slice(0, limit);
  },
  async get${pascal}ById(id: string | number) {
    return this._all("${t.name}").find((r) => String(r[${JSON.stringify(pkName)}]) === String(id)) ?? null;
  },
  async create${pascal}(input: Record<string, unknown>) {
    const row = { ...input };
    if (row[${JSON.stringify(pkName)}] == null) {
      row[${JSON.stringify(pkName)}] = crypto.randomUUID?.() ?? \`local-\${Date.now()}\`;
    }
    this._all("${t.name}").unshift(row);
    this._notify();
    return row;
  },
  async update${pascal}(id: string | number, input: Record<string, unknown>) {
    const rows = this._all("${t.name}");
    const i = rows.findIndex((r) => String(r[${JSON.stringify(pkName)}]) === String(id));
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...input, [${JSON.stringify(pkName)}]: rows[i][${JSON.stringify(pkName)}] };
    this._notify();
    return rows[i];
  },
  async delete${pascal}(id: string | number) {
    const rows = this._all("${t.name}");
    const next = rows.filter((r) => String(r[${JSON.stringify(pkName)}]) !== String(id));
    this.data["${t.name}"] = next;
    this._notify();
    return { ok: true as const, id };
  },`);
  }

  return `/**
 * In-memory preview DB — mirrors Server Action surface for studio / Storybook.
 * Not used in production Server Actions (those hit Neon via Drizzle).
 *
 * Usage (client component):
 *   import { previewDb } from "@/lib/db/preview-store";
 *   const rows = await previewDb.listUsers();
 */
import { PREVIEW_DB_MOCKS } from "./preview-mocks";

type Row = Record<string, unknown>;

function cloneMocks(): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(PREVIEW_DB_MOCKS)) {
    out[k] = (v as Row[]).map((r) => ({ ...r }));
  }
  return out;
}

class PreviewDb {
  data: Record<string, Row[]> = cloneMocks();
  private listeners = new Set<() => void>();

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset() {
    this.data = cloneMocks();
    this._notify();
  }

  _all(table: string): Row[] {
    if (!this.data[table]) this.data[table] = [];
    return this.data[table];
  }

  _notify() {
    for (const fn of this.listeners) fn();
  }
${methods.join("\n")}
  tables() {
    return ${JSON.stringify(tableNames)} as const;
  }
}

export const previewDb = new PreviewDb();
`;
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

export function generateEnvExample(schema: DatabaseSchemaMap): string {
  return `# Shipboard BYOB — database
# Paste your Neon or Supabase connection string (pooled or direct).
DATABASE_URL=postgresql://user:password@host/db?sslmode=require

# Introspected: ${schema.provider} · ${schema.tableCount} table(s)
# Host hint: ${schema.hostHint || "(unknown)"}
# Tables: ${schema.tables.map((t) => t.name).join(", ") || "(none)"}
`;
}

/** package.json dependency bumps for BYOB ship */
export function byobPackageDependencies(): Record<string, string> {
  return {
    "@neondatabase/serverless": "^1.0.0",
    "drizzle-orm": "^0.38.3",
    "drizzle-zod": "^0.6.1",
    zod: "^3.24.1",
  };
}

export function byobDevDependencies(): Record<string, string> {
  return {
    "drizzle-kit": "^0.30.1",
  };
}

/**
 * Full file set for Next ship scaffold when a schema map is present.
 */
export function buildByobShipFiles(
  schema: DatabaseSchemaMap
): { path: string; content: string }[] {
  return [
    { path: "lib/db/schema.ts", content: generateDrizzleSchemaTs(schema) },
    { path: "lib/db/index.ts", content: generateDbClientTs() },
    { path: "app/actions.ts", content: generateServerActionsTs(schema) },
    { path: "lib/db/preview-mocks.ts", content: generatePreviewMocksTs(schema) },
    { path: "lib/db/preview-store.ts", content: generatePreviewStoreTs(schema) },
    { path: ".env.example", content: generateEnvExample(schema) },
  ];
}
