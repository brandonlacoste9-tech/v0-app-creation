import type { DatabaseSchemaMap } from "./types";

/** Compact schema for LLM context (token-efficient). */
export function formatSchemaForPrompt(schema: DatabaseSchemaMap): string {
  const lines: string[] = [
    `## CONNECTED DATABASE (BYOB — ${schema.provider}, ${schema.tableCount} tables)`,
    `Introspected at ${schema.introspectedAt}${schema.hostHint ? ` · host ${schema.hostHint}` : ""}.`,
    `Use these tables when building admin UIs, tables, forms, and dashboards.`,
    `Studio preview cannot run Postgres — seed UI with realistic local useState data shaped like the columns.`,
    `On Ship/export, Shipboard writes Drizzle schema + Server Actions; prefer action names list{Table} / get{Table}ById.`,
    "",
  ];

  for (const t of schema.tables.slice(0, 24)) {
    const cols = t.columns
      .slice(0, 24)
      .map((c) => {
        const flags = [
          c.isPrimaryKey ? "PK" : null,
          c.nullable ? "null" : "not null",
        ]
          .filter(Boolean)
          .join(", ");
        return `${c.name}:${c.dataType}${flags ? `(${flags})` : ""}`;
      })
      .join(", ");
    const fks =
      t.foreignKeys.length > 0
        ? ` FKs: ${t.foreignKeys.map((f) => `${f.column}→${f.refTable}.${f.refColumn}`).join("; ")}`
        : "";
    lines.push(`- ${t.name} { ${cols} }${fks}`);
  }

  if (schema.tables.length > 24) {
    lines.push(`- …and ${schema.tables.length - 24} more tables`);
  }

  lines.push(
    "",
    "UI guidance: show real column labels, support empty states, and wire forms to fields that exist.",
    "Do not invent tables/columns that are not listed."
  );

  return lines.join("\n");
}

export function getByobSystemPrompt(schema: DatabaseSchemaMap | null | undefined): string {
  if (!schema?.tables?.length) return "";
  return "\n\n" + formatSchemaForPrompt(schema);
}
