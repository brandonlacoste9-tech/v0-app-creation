/**
 * BYOB — Bring Your Own Backend schema map (Track B).
 * Introspected from Neon/Supabase Postgres; never stores the connection string.
 */

export type PgDataType =
  | "uuid"
  | "text"
  | "varchar"
  | "integer"
  | "bigint"
  | "boolean"
  | "numeric"
  | "real"
  | "double"
  | "timestamp"
  | "timestamptz"
  | "date"
  | "json"
  | "jsonb"
  | "bytea"
  | "unknown";

export interface SchemaColumn {
  name: string;
  dataType: PgDataType;
  /** Raw Postgres type string from information_schema */
  udtName: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
  maxLength: number | null;
}

export interface SchemaForeignKey {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  foreignKeys: SchemaForeignKey[];
}

export interface DatabaseSchemaMap {
  /** Schema version for local storage / export */
  v: 1;
  dialect: "postgresql";
  provider: "neon" | "supabase" | "postgres";
  /** Public schema tables only (MVP) */
  tables: SchemaTable[];
  introspectedAt: string;
  /** Host only (no credentials) — for UI display */
  hostHint?: string;
  tableCount: number;
}

export interface ByobSettings {
  /** Connected schema map (safe to persist client-side) */
  schema: DatabaseSchemaMap | null;
  /** UI: last connection status */
  lastError?: string;
}
