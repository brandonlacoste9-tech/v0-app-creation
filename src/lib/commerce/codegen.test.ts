import assert from "node:assert/strict";
import { buildNextProjectFiles } from "../github-project";
import { serializeProject, mergeForPreview } from "../project-files";
import { buildCommerceShipFiles } from "./codegen";
import { wantsCommerceShip } from "./detect";
import { attachCommerceFilesToCode } from "./attach";
import { applyCatalogPreviewIntercept, stripPlatformCatalogDeclarations } from "./preview";
import { DEFAULT_CATALOG } from "./catalog";

assert.equal(wantsCommerceShip({ title: "Agent-ready store" }), true);
assert.equal(wantsCommerceShip({ code: 'import { PRODUCTS } from "@/lib/catalog"' }), true);
assert.equal(wantsCommerceShip({ title: "Kanban board" }), false);

const files = buildCommerceShipFiles();
const paths = new Set(files.map((f) => f.path));
for (const need of [
  "lib/catalog.ts",
  "lib/orders.ts",
  "lib/checkout.ts",
  "lib/ucp.ts",
  "lib/channel.ts",
  "app/.well-known/ucp/route.ts",
  "app/mcp/route.ts",
  "app/api/checkout/route.ts",
  "app/api/acp/checkout-sessions/route.ts",
  "app/admin/orders/page.tsx",
]) {
  assert.ok(paths.has(need), "missing " + need);
}

const mcp = files.find((f) => f.path === "app/mcp/route.ts")!.content;
for (const tool of [
  "search_products",
  "get_product",
  "create_checkout_session",
  "get_order",
]) {
  assert.ok(mcp.includes(tool), "mcp tool " + tool);
}

const ucp = files.find((f) => f.path === "app/.well-known/ucp/route.ts")!.content;
assert.ok(ucp.includes("buildUcpProfile"), "ucp profile builder");

const catalog = files.find((f) => f.path === "lib/catalog.ts")!.content;
assert.ok(catalog.includes(DEFAULT_CATALOG.products[0].gtin), "gtin in catalog");
assert.ok(catalog.includes("inventory"), "inventory field");
assert.ok(catalog.includes("brand"), "brand field");

const acp = files.find((f) => f.path === "app/api/acp/checkout-sessions/route.ts")!.content;
assert.ok(acp.includes("Shared Payment Token"), "SPT log");
assert.ok(acp.includes("not captured"), "no capture");

const orders = files.find((f) => f.path === "lib/orders.ts")!.content;
assert.ok(orders.includes("store_orders"), "durable store_orders table");
assert.ok(orders.includes("DATABASE_URL"), "orders read DATABASE_URL");
assert.ok(orders.includes("async function createOrder"), "createOrder is async");
assert.ok(!orders.includes("__northlineOrders"), "no memory-only Northline global");

const admin = files.find((f) => f.path === "app/admin/orders/page.tsx")!.content;
assert.ok(admin.includes("channel"), "admin shows channel");
assert.ok(admin.includes("sku") || admin.includes("SKU"), "admin shows sku");
assert.ok(admin.includes("await listOrders"), "admin awaits durable orders");

const multi = serializeProject(
  {
    "src/Component.tsx": `import { PRODUCTS } from "@/lib/catalog";
function Component() {
  return <main>{PRODUCTS[0].title}</main>;
}
`,
  },
  "src/Component.tsx"
);

const ship = buildNextProjectFiles({
  code: multi,
  title: "Agent-ready store",
  repoSlug: "northline-supply",
});
const shipPaths = new Set(ship.map((f) => f.path));
assert.ok(shipPaths.has("app/.well-known/ucp/route.ts"), "eject includes UCP");
assert.ok(shipPaths.has("app/mcp/route.ts"), "eject includes MCP");
assert.ok(shipPaths.has("netlify.toml"), "still Netlify");
const pkg = JSON.parse(ship.find((f) => f.path === "package.json")!.content);
assert.ok(pkg.dependencies.stripe, "stripe dep on commerce eject");
assert.ok(pkg.dependencies.pg, "pg dep for durable orders");
assert.ok(pkg.devDependencies["@netlify/plugin-nextjs"], "netlify plugin kept");
const env = ship.find((f) => f.path === ".env.example")!.content;
assert.ok(env.includes("STRIPE_SECRET_KEY"), "stripe env");
assert.ok(env.includes("DATABASE_URL"), "database url on commerce eject");

const ordinary = buildNextProjectFiles({
  code: serializeProject(
    { "src/Component.tsx": `function Component() { return <h1>Hi</h1>; }` },
    "src/Component.tsx"
  ),
  title: "Admin Users",
});
assert.ok(
  !ordinary.some((f) => f.path === "app/.well-known/ucp/route.ts"),
  "non-commerce eject has no UCP"
);

{
  const crashed = `function Component() { return <h1>{PRODUCTS[0].title}</h1>; }`;
  const intercept = applyCatalogPreviewIntercept(crashed);
  assert.equal(intercept.applied, true, "intercepts undefined PRODUCTS");
  assert.ok(intercept.code.includes("var PRODUCTS"), "defines PRODUCTS");
  assert.ok(intercept.code.includes("Field notebook") || intercept.code.includes("NL-NB-01"), "has SKU");
}

{
  const doubled = `const PRODUCTS = [{ sku: "X" }];
const PRODUCTS = CATALOG.products;
function Component() { return <h1>{PRODUCTS[0].title}</h1>; }`;
  const stripped = stripPlatformCatalogDeclarations(doubled);
  assert.equal(
    (stripped.match(/\b(?:const|let|var)\s+PRODUCTS\b/g) || []).length,
    0,
    "strips every PRODUCTS binding"
  );
  const intercept = applyCatalogPreviewIntercept(doubled);
  assert.equal(
    (intercept.code.match(/\b(?:const|let|var)\s+PRODUCTS\b/g) || []).length,
    1,
    "injects exactly one PRODUCTS"
  );
}

{
  const crashed = serializeProject(
    {
      "src/Component.tsx": `function Component() {
  return <main>{PRODUCTS.map((p) => p.sku)}</main>;
}
`,
    },
    "src/Component.tsx"
  );
  const attached = attachCommerceFilesToCode(crashed, { title: "Agent-ready store" });
  const parsed = JSON.parse(attached);
  assert.ok(parsed.files["lib/catalog.ts"], "attaches catalog to v1");
  assert.ok(parsed.files["app/.well-known/ucp/route.ts"], "attaches UCP to v1");
  assert.ok(parsed.files["app/mcp/route.ts"], "attaches MCP to v1");
}

{
  const truncatedAcp = serializeProject(
    {
      "src/Component.tsx": `function Component() {
  return <main>{PRODUCTS.map((p) => p.sku)}</main>;
}
`,
      "app/api/acp/checkout-sessions/route.ts": `const items = (Array.isArray(body.line_ite`,
    },
    "src/Component.tsx"
  );
  const attached = attachCommerceFilesToCode(truncatedAcp, {
    title: "Agent-ready store",
  });
  const parsed = JSON.parse(attached);
  const acp = parsed.files["app/api/acp/checkout-sessions/route.ts"] as string;
  assert.ok(acp.includes("line_items"), "rewrites truncated ACP from template");
  assert.ok(!/line_ite$/.test(acp.trim()), "no mid-token cut");
  const merged = mergeForPreview(attached);
  assert.ok(!merged.includes("line_items"), "ACP route stays out of iframe merge");
  assert.ok(merged.includes("function Component"), "UI still merges");
}

{
  const custom = `const PRODUCTS = [{ sku: "CUST-01", title: "Custom mug", price: 2400 }];
function Component() { return <h1>{PRODUCTS[0].title}</h1>; }`;
  const intercept = applyCatalogPreviewIntercept(custom);
  assert.ok(intercept.code.includes("window.formatMoney"), "binds formatMoney on window");
}

{
  const junk = serializeProject(
    {
      "src/Component.tsx": `function Component() {
  return <main>{PRODUCTS.map((p) => p.sku)}</main>;
}
`,
      "public/products/brass-lamp.svg.tsx": `export default function BrassLamp() { return <svg />; }`,
      "public/products/camp-blanket.svg.tsx": `export default function CampBlanket() { return <svg />; }`,
    },
    "src/Component.tsx"
  );
  const attached = attachCommerceFilesToCode(junk, { title: "Harbor Goods" });
  const parsed = JSON.parse(attached);
  assert.ok(!parsed.files["public/products/brass-lamp.svg.tsx"], "drops junk svg.tsx");
  assert.ok(!parsed.files["public/products/camp-blanket.svg.tsx"], "drops camp-blanket.svg.tsx");
  assert.ok(parsed.files["public/products/brass-lamp.svg"], "keeps real SVG asset");
}

console.log("commerce codegen tests: all passed");
