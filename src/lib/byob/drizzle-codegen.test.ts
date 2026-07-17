/**
 * Run: npx tsx src/lib/byob/drizzle-codegen.test.ts
 */
import type { DatabaseSchemaMap } from "./types";
import {
  buildByobShipFiles,
  generateDrizzleSchemaTs,
  generateRelationsBlock,
  generateServerActionsTs,
  generateZodSchemasBlock,
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
  assert(schemaTs.includes("drizzle-zod"), "drizzle-zod import");
  assert(schemaTs.includes("insertUsersSchema"), "insert zod");
  assert(schemaTs.includes("updateUsersSchema"), "update zod");
  assert(schemaTs.includes("selectPostsSchema"), "select zod");
  assert(schemaTs.includes("relations("), "relations import usage");
  assert(schemaTs.includes("usersRelations"), "usersRelations");
  assert(schemaTs.includes("postsRelations"), "postsRelations");
  assert(schemaTs.includes("many(posts)"), "many posts");
  assert(schemaTs.includes("one(users"), "one users");
}

{
  const rel = generateRelationsBlock(sample);
  assert(rel.includes("posts: many(posts)"), "many side");
  assert(rel.includes("user: one(users"), "one side field user from user_id");
  assert(rel.includes("fields: [posts.userId]"), "FK field camelCase");
  assert(rel.includes("references: [users.id]"), "PK ref");
}

{
  const zod = generateZodSchemasBlock(sample);
  assert(zod.includes("createInsertSchema"), "createInsert");
  assert(zod.includes(".omit({ id: true })"), "omit default uuid pk on insert");
}

{
  const actions = generateServerActionsTs(sample);
  assert(actions.includes('"use server"'), "server actions");
  assert(actions.includes("listUsers"), "listUsers");
  assert(actions.includes("createUsers"), "createUsers");
  assert(actions.includes("updateUsers"), "updateUsers");
  assert(actions.includes("deleteUsers"), "deleteUsers");
  assert(actions.includes("insertUsersSchema.parse"), "zod parse create");
  assert(actions.includes("updateUsersSchema.parse"), "zod parse update");
  assert(actions.includes("getUsersWithRelations"), "relational get");
  assert(actions.includes("with:"), "with clause");
}

{
  const files = buildByobShipFiles(sample);
  const paths = files.map((f) => f.path);
  assert(paths.includes("lib/db/schema.ts"), "schema path");
  assert(paths.includes("lib/db/index.ts"), "index path");
  assert(paths.includes("app/actions.ts"), "actions path");
  assert(paths.includes(".env.example"), "env example");
  assert(paths.includes("lib/db/preview-mocks.ts"), "preview mocks");
  assert(paths.includes("lib/db/preview-store.ts"), "preview store");
  const store = files.find((f) => f.path === "lib/db/preview-store.ts")!.content;
  assert(store.includes("previewDb"), "previewDb export");
  assert(store.includes("createUsers"), "store create");
}

{
  const prompt = formatSchemaForPrompt(sample);
  assert(prompt.includes("users"), "prompt users");
  assert(prompt.includes("createUsers"), "prompt mutations");
  assert(prompt.includes("insert{Table}Schema") || prompt.includes("drizzle-zod"), "prompt zod");
  assert(prompt.includes("Relational Query") || prompt.includes("with:"), "prompt relational");
}

{
  const ship = buildShipProjectFiles({
    code: `function Component(){return <div className="p-8">Hi</div>}`,
    title: "Demo",
    stack: "next",
    byobSchema: sample,
  });
  assert(ship.some((f) => f.path === "lib/db/schema.ts"), "ship has drizzle");
  assert(ship.some((f) => f.path === "lib/db/preview-store.ts"), "ship has store");
  const pkg = JSON.parse(ship.find((f) => f.path === "package.json")!.content);
  assert(pkg.dependencies["drizzle-orm"], "drizzle dep");
  assert(pkg.dependencies["drizzle-zod"], "drizzle-zod dep");
  assert(pkg.dependencies["zod"], "zod dep");
  const schemaFile = ship.find((f) => f.path === "lib/db/schema.ts")!.content;
  assert(schemaFile.includes("usersRelations"), "ship relations");
}

console.log("byob drizzle-codegen tests: all passed");
