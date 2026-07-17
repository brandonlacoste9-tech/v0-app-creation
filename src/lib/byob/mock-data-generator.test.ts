/**
 * Schema-aware mock data generator.
 * Run: npx tsx src/lib/byob/mock-data-generator.test.ts
 */
import {
  assertMockStoreShape,
  FIXTURE_BLOG_SCHEMA,
  FIXTURE_ECOM_SCHEMA,
  generateInitialMockStore,
  orderTablesForSeeding,
} from "./mock-data-generator";
import { generatePreviewActionsInline } from "./preview-intercept";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

// topo order: users before posts
{
  const ordered = orderTablesForSeeding(FIXTURE_BLOG_SCHEMA.tables);
  assert(ordered[0].name === "users", "users first");
  assert(ordered[1].name === "posts", "posts second");
}

// blog: realistic emails/names + FK integrity
{
  const store = generateInitialMockStore(FIXTURE_BLOG_SCHEMA, {
    rowsPerTable: 4,
    seed: 42,
  });
  const errs = assertMockStoreShape(FIXTURE_BLOG_SCHEMA, store, { minRows: 4 });
  assert(errs.length === 0, `blog shape: ${errs.join("; ")}`);

  const user = store.users[0];
  assert(typeof user.email === "string" && String(user.email).includes("@"), "email");
  assert(
    typeof user.name === "string" && !String(user.name).startsWith("users_"),
    "name not placeholder"
  );
  assert(
    !String(user.name).includes("Sample "),
    "no Sample prefix on name"
  );

  // deterministic
  const store2 = generateInitialMockStore(FIXTURE_BLOG_SCHEMA, {
    rowsPerTable: 4,
    seed: 42,
  });
  assert(
    JSON.stringify(store) === JSON.stringify(store2),
    "same seed → same store"
  );
}

// ecommerce: order_items FKs resolve
{
  const store = generateInitialMockStore(FIXTURE_ECOM_SCHEMA, {
    rowsPerTable: 3,
    seed: 7,
  });
  const errs = assertMockStoreShape(FIXTURE_ECOM_SCHEMA, store, { minRows: 3 });
  assert(errs.length === 0, `ecom shape: ${errs.join("; ")}`);
  assert(typeof store.products[0].price === "number", "price number");
  assert(typeof store.products[0].stock === "number", "stock number");
}

// intercept embeds richer seeds
{
  const inline = generatePreviewActionsInline(FIXTURE_BLOG_SCHEMA);
  assert(inline.includes("__previewDb"), "has db");
  assert(inline.includes("@preview.dev") || inline.includes("email"), "seed content");
  // should not be the old 2-row ultra-generic only pattern exclusively
  assert(inline.includes("schema mock data"), "banner comment");
}

// empty schema
{
  const empty = generateInitialMockStore({
    v: 1,
    dialect: "postgresql",
    provider: "neon",
    tables: [],
    introspectedAt: "",
    tableCount: 0,
  });
  assert(Object.keys(empty).length === 0, "empty store");
}

console.log("mock-data-generator tests: all passed");
