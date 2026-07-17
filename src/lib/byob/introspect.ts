/**
 * Read-only PostgreSQL introspection via Neon serverless HTTP driver.
 * Connection string is used only for this request — never persisted by the API.
 */
import { neon } from "@neondatabase/serverless";
import type {
  DatabaseSchemaMap,
  PgDataType,
  SchemaColumn,
  SchemaForeignKey,
  SchemaTable,
} from "./types";

const MAX_TABLES = 40;
const MAX_COLUMNS_PER_TABLE = 80;

export function detectProvider(
  connectionString: string
): DatabaseSchemaMap["provider"] {
  const u = connectionString.toLowerCase();
  if (u.includes("neon.tech") || u.includes("neon.")) return "neon";
  if (u.includes("supabase.co") || u.includes("supabase")) return "supabase";
  return "postgres";
}

export function hostHintFromUrl(connectionString: string): string | undefined {
  try {
    const normalized = connectionString
      .replace(/^postgresql:/i, "http:")
      .replace(/^postgres:/i, "http:");
    const url = new URL(normalized);
    return url.hostname || undefined;
  } catch {
    return undefined;
  }
}

export function assertSafeConnectionString(raw: string): string {
  const s = raw.trim();
  if (!s) throw new Error("Connection string is empty");
  if (s.length > 2000) throw new Error("Connection string is too long");
  if (!/^postgres(ql)?:\/\//i.test(s)) {
    throw new Error("Must be a postgres:// or postgresql:// connection string");
  }
  // Block obviously local secrets from being exfiltrated in weird ways — still allow local PG
  if (/[;\n\r]/.test(s)) {
    throw new Error("Invalid characters in connection string");
  }
  return s;
}

function mapUdt(udt: string, dataType: string): PgDataType {
  const u = (udt || dataType || "").toLowerCase();
  if (u === "uuid") return "uuid";
  if (u === "text" || u === "citext") return "text";
  if (u === "varchar" || u === "bpchar" || u === "character varying") return "varchar";
  if (u === "int4" || u === "integer" || u === "serial") return "integer";
  if (u === "int8" || u === "bigint" || u === "bigserial") return "bigint";
  if (u === "bool" || u === "boolean") return "boolean";
  if (u === "numeric" || u === "decimal") return "numeric";
  if (u === "float4" || u === "real") return "real";
  if (u === "float8" || u === "double precision") return "double";
  if (u === "timestamp" || u === "timestamp without time zone") return "timestamp";
  if (u === "timestamptz" || u === "timestamp with time zone") return "timestamptz";
  if (u === "date") return "date";
  if (u === "json") return "json";
  if (u === "jsonb") return "jsonb";
  if (u === "bytea") return "bytea";
  return "unknown";
}

interface ColRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  ordinal_position: number;
}

interface PkRow {
  table_name: string;
  column_name: string;
}

interface FkRow {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

/**
 * Introspect public schema tables (read-only SQL against information_schema).
 */
export async function introspectPostgres(
  connectionString: string
): Promise<DatabaseSchemaMap> {
  const url = assertSafeConnectionString(connectionString);
  const sql = neon(url);

  // Fixed queries only — no user-interpolated SQL
  const columns = (await sql`
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length,
      c.ordinal_position
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position
  `) as ColRow[];

  const pks = (await sql`
    SELECT
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
  `) as PkRow[];

  const fks = (await sql`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
  `) as FkRow[];

  const pkSet = new Set(pks.map((r) => `${r.table_name}.${r.column_name}`));
  const fkByTable = new Map<string, SchemaForeignKey[]>();
  for (const r of fks) {
    const list = fkByTable.get(r.table_name) || [];
    list.push({
      column: r.column_name,
      refTable: r.foreign_table_name,
      refColumn: r.foreign_column_name,
    });
    fkByTable.set(r.table_name, list);
  }

  const byTable = new Map<string, SchemaColumn[]>();
  for (const row of columns) {
    const list = byTable.get(row.table_name) || [];
    if (list.length >= MAX_COLUMNS_PER_TABLE) continue;
    list.push({
      name: row.column_name,
      dataType: mapUdt(row.udt_name, row.data_type),
      udtName: row.udt_name,
      nullable: row.is_nullable === "YES",
      isPrimaryKey: pkSet.has(`${row.table_name}.${row.column_name}`),
      defaultValue: row.column_default,
      maxLength: row.character_maximum_length,
    });
    byTable.set(row.table_name, list);
  }

  const tableNames = [...byTable.keys()].sort().slice(0, MAX_TABLES);
  const tables: SchemaTable[] = tableNames.map((name) => ({
    name,
    columns: byTable.get(name) || [],
    foreignKeys: fkByTable.get(name) || [],
  }));

  return {
    v: 1,
    dialect: "postgresql",
    provider: detectProvider(url),
    tables,
    introspectedAt: new Date().toISOString(),
    hostHint: hostHintFromUrl(url),
    tableCount: tables.length,
  };
}
