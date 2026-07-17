/**
 * Schema-aware mock seed data for BYOB preview intercept.
 *
 * When a user connects Neon/Supabase, the iframe mock store is filled with
 * plausible rows (names, emails, FKs, dates) so tables/forms feel production-like.
 * Ship path is untouched — this only seeds `__previewDb` in the studio projection.
 */
import type {
  DatabaseSchemaMap,
  PgDataType,
  SchemaColumn,
  SchemaTable,
} from "./types";

export type MockStore = Record<string, Record<string, unknown>[]>;

export interface MockGenOptions {
  /** Rows per table (default 5, clamped 1–12) */
  rowsPerTable?: number;
  /** Deterministic seed for tests; omit for time-varied live previews */
  seed?: number;
}

const FIRST = [
  "Ada",
  "Grace",
  "Alan",
  "Lin",
  "Katherine",
  "Margaret",
  "Dennis",
  "Barbara",
  "Tim",
  "Radia",
];
const LAST = [
  "Lovelace",
  "Hopper",
  "Turing",
  "Torvalds",
  "Johnson",
  "Hamilton",
  "Ritchie",
  "Liskov",
  "Berners-Lee",
  "Perlman",
];
const WORDS = [
  "nebula",
  "harbor",
  "signal",
  "orbit",
  "canvas",
  "ledger",
  "pulse",
  "forge",
  "summit",
  "river",
  "atlas",
  "prism",
];
const TITLES = [
  "Ship the preview",
  "Hybrid single-pass",
  "Schema-driven mocks",
  "Type-safe actions",
  "Studio to eject",
  "Neon + Drizzle",
  "Agent tool bus",
  "Continue the cut",
];
const STATUS = ["active", "draft", "archived", "pending", "published"];
const ROLES = ["admin", "member", "viewer", "owner"];

/** Small deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function clampRows(n: number | undefined): number {
  const v = n == null ? 5 : Math.floor(n);
  return Math.min(12, Math.max(1, v));
}

function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/**
 * Order tables so parents (referenced by FKs) come before children.
 * Cycles / unknowns: append remaining tables in original order.
 */
export function orderTablesForSeeding(tables: SchemaTable[]): SchemaTable[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const indeg = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const t of tables) {
    indeg.set(t.name, indeg.get(t.name) ?? 0);
    for (const fk of t.foreignKeys) {
      if (!byName.has(fk.refTable)) continue;
      indeg.set(t.name, (indeg.get(t.name) ?? 0) + 1);
      const list = children.get(fk.refTable) || [];
      list.push(t.name);
      children.set(fk.refTable, list);
      if (!indeg.has(fk.refTable)) indeg.set(fk.refTable, 0);
    }
  }

  const queue: string[] = [];
  for (const [name, d] of indeg) {
    if (d === 0 && byName.has(name)) queue.push(name);
  }

  const ordered: SchemaTable[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const t = byName.get(name);
    if (t) ordered.push(t);
    for (const child of children.get(name) || []) {
      const next = (indeg.get(child) ?? 1) - 1;
      indeg.set(child, next);
      if (next <= 0) queue.push(child);
    }
  }

  for (const t of tables) {
    if (!seen.has(t.name)) ordered.push(t);
  }
  return ordered;
}

function uuidFromSeed(rng: () => number, n: number): string {
  const hex = () =>
    Math.floor(rng() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `00000000-0000-4000-8${hex().slice(0, 3)}-${hex()}${hex()}${String(n).padStart(4, "0")}`;
}

/** Epoch for relative dates — fixed when seeded so tests are deterministic. */
function recentIso(
  rng: () => number,
  daysBack = 60,
  epochMs = 1_704_067_200_000 // 2024-01-01 UTC
): string {
  const ms = epochMs - Math.floor(rng() * daysBack * 86400000);
  return new Date(ms).toISOString();
}

function dateOnly(rng: () => number, epochMs?: number): string {
  return recentIso(rng, 90, epochMs).slice(0, 10);
}

function valueForColumn(
  col: SchemaColumn,
  rowIndex: number,
  table: SchemaTable,
  store: MockStore,
  rng: () => number,
  epochMs: number
): unknown {
  const n = rowIndex + 1;
  const key = norm(col.name);
  const fk = table.foreignKeys.find((f) => f.column === col.name);

  // FK → pick parent id
  if (fk) {
    const parents = store[fk.refTable] || [];
    if (parents.length) {
      const parent = parents[rowIndex % parents.length];
      const v = parent[fk.refColumn];
      if (v != null) return v;
    }
  }

  if (col.isPrimaryKey) {
    if (col.dataType === "uuid" || col.udtName === "uuid") {
      return uuidFromSeed(rng, n);
    }
    if (
      col.dataType === "integer" ||
      col.dataType === "bigint" ||
      /int|serial/i.test(col.udtName)
    ) {
      return n;
    }
    return `${table.name.slice(0, 1)}${n}`;
  }

  // Name-driven text
  if (
    col.dataType === "text" ||
    col.dataType === "varchar" ||
    col.dataType === "unknown"
  ) {
    if (/email/.test(key)) {
      const f = pick(rng, FIRST).toLowerCase();
      const l = pick(rng, LAST).toLowerCase();
      return `${f}.${l}${n}@preview.dev`;
    }
    if (/full_?name|display_?name|^name$/.test(key)) {
      return `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    }
    if (/first_?name|given/.test(key)) return pick(rng, FIRST);
    if (/last_?name|surname|family/.test(key)) return pick(rng, LAST);
    if (/title|subject|headline/.test(key)) {
      return `${pick(rng, TITLES)}${n > 3 ? ` #${n}` : ""}`;
    }
    if (/slug|handle|username/.test(key)) {
      return `${pick(rng, WORDS)}-${pick(rng, WORDS)}-${n}`;
    }
    if (/role/.test(key)) return pick(rng, ROLES);
    if (/status|state/.test(key)) return pick(rng, STATUS);
    if (/phone|mobile/.test(key)) {
      return `+1-555-${String(1000 + Math.floor(rng() * 9000))}`;
    }
    if (/url|website|href|link/.test(key)) {
      return `https://example.com/${pick(rng, WORDS)}`;
    }
    if (
      /description|body|content|bio|summary|notes|message|comment/.test(key)
    ) {
      return `${pick(rng, TITLES)}. Built with Shipboard preview mocks (${pick(rng, WORDS)}).`;
    }
    if (/color|colour/.test(key)) {
      const colors = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#eab308"];
      return pick(rng, colors);
    }
    // enum-like udt
    if (col.udtName && !/^(text|varchar|bpchar|citext|uuid)$/i.test(col.udtName)) {
      // unknown enum → status-like tokens
      return pick(rng, STATUS);
    }
    return `${table.name}_${col.name}_${n}`;
  }

  if (col.dataType === "boolean") {
    return rng() > 0.35;
  }

  if (
    col.dataType === "integer" ||
    col.dataType === "bigint" ||
    col.dataType === "numeric" ||
    col.dataType === "real" ||
    col.dataType === "double"
  ) {
    if (/price|amount|cost|total|salary/.test(key)) {
      return Math.round((rng() * 200 + 5) * 100) / 100;
    }
    if (/rating|score/.test(key)) {
      return Math.round((rng() * 4 + 1) * 10) / 10;
    }
    if (/qty|quantity|count|stock/.test(key)) {
      return Math.floor(rng() * 50) + 1;
    }
    return Math.floor(rng() * 100) + n;
  }

  if (
    col.dataType === "timestamp" ||
    col.dataType === "timestamptz" ||
    /timestamp/i.test(col.udtName)
  ) {
    return recentIso(rng, 60, epochMs);
  }
  if (col.dataType === "date" || col.udtName === "date") {
    return dateOnly(rng, epochMs);
  }

  if (col.dataType === "json" || col.dataType === "jsonb") {
    if (/settings|prefs|config/.test(key)) {
      return { theme: pick(rng, ["dark", "light", "system"]), notifications: rng() > 0.5 };
    }
    if (/meta|metadata/.test(key)) {
      return { source: "shipboard-preview", n, tag: pick(rng, WORDS) };
    }
    return { demo: true, n };
  }

  if (col.dataType === "uuid") {
    return uuidFromSeed(rng, n + 100);
  }

  if (col.dataType === "bytea") {
    return null;
  }

  if (col.nullable && rng() > 0.85) return null;

  return `${col.name}_${n}`;
}

/**
 * Generate `count` rows for one table, using existing store for FK pools.
 */
export function generateMockRowsForTable(
  table: SchemaTable,
  options?: {
    count?: number;
    existingData?: MockStore;
    seed?: number;
    /** Fixed clock for date columns (ms). Default stable epoch for determinism. */
    epochMs?: number;
  }
): Record<string, unknown>[] {
  const count = clampRows(options?.count);
  const rng = createRng(
    options?.seed ??
      (table.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 997 +
        42)
  );
  const epochMs = options?.epochMs ?? 1_704_067_200_000;
  const store: MockStore = { ...(options?.existingData || {}) };
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const row: Record<string, unknown> = {};
    for (const col of table.columns) {
      row[col.name] = valueForColumn(col, i, table, store, rng, epochMs);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Full mock store for a schema map (topo-ordered tables).
 */
export function generateInitialMockStore(
  schema: DatabaseSchemaMap | null | undefined,
  options?: MockGenOptions
): MockStore {
  if (!schema?.tables?.length) return {};

  const rowsPerTable = clampRows(options?.rowsPerTable);
  const baseSeed =
    options?.seed ??
    Math.floor(Date.now() / 60000) ^ (schema.tableCount * 7919);

  const ordered = orderTablesForSeeding(schema.tables);
  const store: MockStore = {};

  const epochMs = 1_704_067_200_000 + (baseSeed % 86_400_000);

  ordered.forEach((table, ti) => {
    store[table.name] = generateMockRowsForTable(table, {
      count: rowsPerTable,
      existingData: store,
      seed: baseSeed + ti * 1009,
      epochMs,
    });
  });

  return store;
}

/** Lightweight validator for tests / audit. */
export function assertMockStoreShape(
  schema: DatabaseSchemaMap,
  store: MockStore,
  opts?: { minRows?: number }
): string[] {
  const errors: string[] = [];
  const minRows = opts?.minRows ?? 1;

  for (const table of schema.tables) {
    const rows = store[table.name];
    if (!Array.isArray(rows)) {
      errors.push(`missing table ${table.name}`);
      continue;
    }
    if (rows.length < minRows) {
      errors.push(`${table.name}: expected ≥${minRows} rows, got ${rows.length}`);
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (const col of table.columns) {
        if (!(col.name in row)) {
          errors.push(`${table.name}[${i}] missing column ${col.name}`);
          continue;
        }
        const v = row[col.name];
        if (v === null && col.nullable) continue;
        if (v === null && !col.nullable) {
          // allow null for bytea / rare cases
          if (col.dataType !== "bytea") {
            errors.push(`${table.name}[${i}].${col.name} is null (non-nullable)`);
          }
          continue;
        }
        const jsOk = valueMatchesType(v, col.dataType);
        if (!jsOk) {
          errors.push(
            `${table.name}[${i}].${col.name} type mismatch for ${col.dataType}: ${typeof v}`
          );
        }
        // Quality: emails look like emails
        if (/email/i.test(col.name) && typeof v === "string" && !v.includes("@")) {
          errors.push(`${table.name}[${i}].${col.name} not a plausible email`);
        }
      }
      // FK integrity
      for (const fk of table.foreignKeys) {
        const parents = store[fk.refTable] || [];
        if (!parents.length) continue;
        const val = row[fk.column];
        if (val == null) continue;
        const ok = parents.some((p) => String(p[fk.refColumn]) === String(val));
        if (!ok) {
          errors.push(
            `${table.name}[${i}].${fk.column}=${val} not in ${fk.refTable}.${fk.refColumn}`
          );
        }
      }
    }
  }
  return errors;
}

function valueMatchesType(v: unknown, t: PgDataType): boolean {
  if (v === null || v === undefined) return true;
  switch (t) {
    case "boolean":
      return typeof v === "boolean";
    case "integer":
    case "bigint":
    case "numeric":
    case "real":
    case "double":
      return typeof v === "number" && !Number.isNaN(v);
    case "json":
    case "jsonb":
      return typeof v === "object";
    case "uuid":
    case "text":
    case "varchar":
    case "timestamp":
    case "timestamptz":
    case "date":
    case "unknown":
      return typeof v === "string" || typeof v === "number";
    case "bytea":
      return true;
    default:
      return true;
  }
}

/** Fixtures for tests — small but realistic schemas */
export const FIXTURE_BLOG_SCHEMA: DatabaseSchemaMap = {
  v: 1,
  dialect: "postgresql",
  provider: "neon",
  introspectedAt: "2026-01-01T00:00:00.000Z",
  tableCount: 2,
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
          name: "name",
          dataType: "text",
          udtName: "text",
          nullable: false,
          isPrimaryKey: false,
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
          name: "role",
          dataType: "text",
          udtName: "text",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
      ],
      foreignKeys: [],
    },
    {
      name: "posts",
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
          name: "title",
          dataType: "text",
          udtName: "text",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "body",
          dataType: "text",
          udtName: "text",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "author_id",
          dataType: "uuid",
          udtName: "uuid",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "published_at",
          dataType: "timestamptz",
          udtName: "timestamptz",
          nullable: true,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
      ],
      foreignKeys: [
        { column: "author_id", refTable: "users", refColumn: "id" },
      ],
    },
  ],
};

export const FIXTURE_ECOM_SCHEMA: DatabaseSchemaMap = {
  v: 1,
  dialect: "postgresql",
  provider: "supabase",
  introspectedAt: "2026-01-01T00:00:00.000Z",
  tableCount: 3,
  tables: [
    {
      name: "products",
      columns: [
        {
          name: "id",
          dataType: "integer",
          udtName: "int4",
          nullable: false,
          isPrimaryKey: true,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "title",
          dataType: "text",
          udtName: "text",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "price",
          dataType: "numeric",
          udtName: "numeric",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "stock",
          dataType: "integer",
          udtName: "int4",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
      ],
      foreignKeys: [],
    },
    {
      name: "orders",
      columns: [
        {
          name: "id",
          dataType: "integer",
          udtName: "int4",
          nullable: false,
          isPrimaryKey: true,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "status",
          dataType: "text",
          udtName: "text",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "total",
          dataType: "numeric",
          udtName: "numeric",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "created_at",
          dataType: "timestamptz",
          udtName: "timestamptz",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
      ],
      foreignKeys: [],
    },
    {
      name: "order_items",
      columns: [
        {
          name: "id",
          dataType: "integer",
          udtName: "int4",
          nullable: false,
          isPrimaryKey: true,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "order_id",
          dataType: "integer",
          udtName: "int4",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "product_id",
          dataType: "integer",
          udtName: "int4",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "quantity",
          dataType: "integer",
          udtName: "int4",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
      ],
      foreignKeys: [
        { column: "order_id", refTable: "orders", refColumn: "id" },
        { column: "product_id", refTable: "products", refColumn: "id" },
      ],
    },
  ],
};
