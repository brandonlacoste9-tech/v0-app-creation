/**
 * Run: npx tsx src/lib/byob/drizzle-codegen.test.ts
 */
import type { DatabaseSchemaMap } from "./types";
import {
  buildByobShipFiles,
  generateDrizzleSchemaTs,
  generateServerActionsTs,
} from "./drizzle-codegen";
import { formatSchemaForPrompt } from "./prompt";
import { buildShipProjectFiles } from "../github-project";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

const sample: DatabaseSchemaMap = {
  v: 1,
  dialect: "postgresql",
  provider: "neon",
  introspectedAt: "2026-01-01T00:00:00.000Z",
  hostHint: "ep-demo.neon.tech",
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
          defaultValue: "gen_random_uuid()",
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
          name: "created_at",
          dataType: "timestamptz",
          udtName: "timestamptz",
          nullable: true,
          isPrimaryKey: false,
          defaultValue: "now()",
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
          name: "user_id",
          dataType: "uuid",
          udtName: "uuid",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
        {
          name: "title",
          dataType: "varchar",
          udtName: "varchar",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: 200,
        },
      ],
      foreignKeys: [{ column: "user_id", refTable: "users", refColumn: "id" }],
    },
  ],
};

{
  const schemaTs = generateDrizzleSchemaTs(sample);
  assert(schemaTs.includes('pgTable("users"'), "users table");
  assert(schemaTs.includes('pgTable("posts"'), "posts table");
  assert(schemaTs.includes("uuid("), "uuid cols");
  assert(schemaTs.includes("export const users"), "export users");
}

{
  const actions = generateServerActionsTs(sample);
  assert(actions.includes('"use server"'), "server actions");
  assert(actions.includes("listUsers"), "listUsers");
  assert(actions.includes("listPosts"), "listPosts");
  assert(actions.includes("getUsersById"), "getUsersById");
}

{
  const files = buildByobShipFiles(sample);
  const paths = files.map((f) => f.path);
  assert(paths.includes("lib/db/schema.ts"), "schema path");
  assert(paths.includes("lib/db/index.ts"), "index path");
  assert(paths.includes("app/actions.ts"), "actions path");
  assert(paths.includes(".env.example"), "env example");
  assert(paths.includes("lib/db/preview-mocks.ts"), "preview mocks");
}

{
  const prompt = formatSchemaForPrompt(sample);
  assert(prompt.includes("users"), "prompt users");
  assert(prompt.includes("posts"), "prompt posts");
  assert(prompt.includes("BYOB"), "prompt byob");
}

{
  const ship = buildShipProjectFiles({
    code: `function Component(){return <div className="p-8">Hi</div>}`,
    title: "Demo",
    stack: "next",
    byobSchema: sample,
  });
  assert(ship.some((f) => f.path === "lib/db/schema.ts"), "ship has drizzle");
  assert(ship.some((f) => f.path === "app/actions.ts"), "ship has actions");
  const pkg = JSON.parse(ship.find((f) => f.path === "package.json")!.content);
  assert(pkg.dependencies["drizzle-orm"], "drizzle dep");
  assert(pkg.dependencies["@neondatabase/serverless"], "neon dep");
  const readme = ship.find((f) => f.path === "README.md")!.content;
  assert(readme.includes("DATABASE_URL") || readme.includes("Drizzle"), "readme byob");
}

console.log("byob drizzle-codegen tests: all passed");
