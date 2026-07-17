import type { DatabaseSchemaMap } from "./types";

function toPascal(name: string): string {
  const c = name.replace(/_([a-z])/g, (_, x: string) => x.toUpperCase());
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** Compact schema for LLM context (token-efficient). */
export function formatSchemaForPrompt(schema: DatabaseSchemaMap): string {
  const lines: string[] = [
    `## CONNECTED DATABASE (BYOB — ${schema.provider}, ${schema.tableCount} tables)`,
    `Introspected at ${schema.introspectedAt}${schema.hostHint ? ` · host ${schema.hostHint}` : ""}.`,
    `Use these tables when building admin UIs, tables, forms, and dashboards.`,
    "",
    "### Data access rules (STRICT)",
    "- Do NOT invent tables or columns. Only use names listed below.",
    "- Write **production** data access only:",
    '  `import { listUsers, createUsers, updateUsers, deleteUsers } from "@/app/actions"`',
    "  (use real table Pascal names from the list below).",
    "- Studio preview transparently intercepts those imports — do NOT import preview-store, do NOT dual-path for preview.",
    "- On Ship/export, Shipboard already generates (do not re-author these files):",
    "  · lib/db/schema.ts — pgTable + relations() + insert/update/select Zod via drizzle-zod",
    "  · lib/db/index.ts — getDb()",
    "  · app/actions.ts — list/get/create/update/delete + *WithRelations",
    "  · lib/db/preview-store.ts — same named exports for offline demos",
    "",
    "### Preferred Server Action names (Pascal = table name)",
  ];

  for (const t of schema.tables.slice(0, 16)) {
    const p = toPascal(t.name);
    lines.push(
      `- ${t.name}: list${p}, get${p}ById, create${p}, update${p}, delete${p}` +
        (t.foreignKeys.length || schema.tables.some((o) => o.foreignKeys.some((f) => f.refTable === t.name))
          ? `, get${p}WithRelations`
          : "")
    );
  }

  lines.push(
    "",
    "### Validation",
    "- Mutations must use insert{Table}Schema / update{Table}Schema from lib/db/schema (already in app/actions).",
    "- Prefer Relational Query API when nested data is needed: db.query.{table}.findFirst({ with: { … } }).",
    "- Do not invent raw SQL joins when a relation exists.",
    "",
    "### Tables"
  );

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
    "UI guidance: real column labels, empty states, forms bound to real fields only."
  );

  return lines.join("\n");
}

export function getByobSystemPrompt(schema: DatabaseSchemaMap | null | undefined): string {
  if (!schema?.tables?.length) return "";
  return "\n\n" + formatSchemaForPrompt(schema);
}
