import assert from "node:assert/strict";
import { buildNextProjectFiles } from "../github-project";
import { serializeProject, mergeForPreview } from "../project-files";
import { buildCommerceShipFiles } from "./codegen";
import { wantsCommerceShip } from "./detect";
import { attachCommerceFilesToCode } from "./attach";
import { applyCatalogPreviewIntercept, extractProductsArrayLiteral, stripPlatformCatalogDeclarations } from "./preview";
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
assert.ok(pkg.devDependencies["@types/pg"], "pg types so next build typechecks");
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
  const typed = `const PRODUCTS: { sku: string; title: string }[] = [{ sku: "X", title: "Typed" }];
function Component() { return <h1>{PRODUCTS[0].title}</h1>; }`;
  const stripped = stripPlatformCatalogDeclarations(typed);
  assert.equal(
    (stripped.match(/\b(?:const|let|var)\s+PRODUCTS\b/g) || []).length,
    0,
    "strips typed const PRODUCTS: T[] ="
  );
  const intercept = applyCatalogPreviewIntercept(typed);
  assert.equal(
    (intercept.code.match(/\b(?:const|let|var)\s+PRODUCTS\b/g) || []).length,
    1,
    "typed decl still one binding after intercept"
  );
  const lit = extractProductsArrayLiteral(typed);
  assert.ok(lit && lit.includes("Typed"), "extracts typed PRODUCTS array");
  assert.ok(intercept.code.includes("Typed"), "custom SKUs survive intercept");
  assert.ok(!intercept.code.includes("Camp blanket"), "does not inject Northline");
}

{
  const split = `const formatMoney = (window as any)
.formatMoney ? (window as any).formatMoney : String;
function ProductGrid() { return <p>grid</p>; }`;
  const stripped = stripPlatformCatalogDeclarations(split);
  assert.ok(!/\.formatMoney\s*\?/.test(stripped), "no leftover .formatMoney ternary");
  assert.ok(stripped.includes("function ProductGrid"), "keeps ProductGrid");
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

{
  const merchant = serializeProject(
    {
      "src/Component.tsx": `const PRODUCTS = [
  { sku: "HG-NB-01", title: "Field Notebook", price: 1800, currency: "usd" },
  { sku: "HG-SB-02", title: "Steel Bottle", price: 3400, currency: "usd" }
];
function Component() { return <main>{PRODUCTS[0].title}</main>; }
`,
    },
    "src/Component.tsx"
  );
  const attached = attachCommerceFilesToCode(merchant, { title: "Harbor Goods" });
  const parsed = JSON.parse(attached);
  const catalog = parsed.files["lib/catalog.ts"] || parsed.files["src/lib/catalog.ts"] || "";
  assert.ok(catalog.includes("Harbor Goods"), "catalog merchant is the store name");
  assert.ok(catalog.includes("1800"), "catalog keeps merchant $18");
  assert.ok(!catalog.includes("2800"), "catalog does not keep Northline $28");
}

{
  const poisoned =
    "Fix these UI quality issues.\nRequirements: real useState where needed, no lorem.\nDo not claim the preview compiles. The platform Babel-checks the result after you return.";
  const files = buildCommerceShipFiles({
    title: poisoned,
    productsLiteral: `[{ "sku": "MONSTERA-DEL", "title": "Monstera Deliciosa", "price": 3800, "brand": "Fern and Field" }]`,
    fallbackName: "Fern and Field",
  });
  for (const file of files) {
    assert.ok(!file.content.includes("Do not claim the preview compiles"), "leak " + file.path);
    assert.ok(!/async\s+export/.test(file.content), "async export " + file.path);
  }
  const catalog = files.find((f) => f.path === "lib/catalog.ts")!.content;
  assert.ok(catalog.includes("Fern and Field"), "brand wins over the prompt title");
  assert.ok(catalog.includes("MONSTERA-DEL"), "fern sku kept");
  const acp = files.find((f) => f.path === "app/api/acp/checkout-sessions/route.ts")!.content;
  assert.ok(
    acp.includes("export async function OPTIONS(req: Request)"),
    "OPTIONS typed like GET"
  );
  assert.ok(acp.includes("export async function GET(req: Request)"), "GET still typed");
  assert.ok(!acp.includes("export default"), "ACP route is not a default export");
}

{
  // P0 catalog fidelity: wizard products are the single source of truth for
  // BOTH the emitted catalog and the asset manifest. No invented Northline
  // placeholders, no dropped products.
  const harborLiteral = JSON.stringify([
    { id: "canvas-tote", sku: "HG-TOTE-01", title: "Canvas Tote", price: 4200, currency: "usd" },
    { id: "field-notebook", sku: "HG-NOTE-02", title: "Field Notebook", price: 1800, currency: "usd" },
    { id: "steel-bottle", sku: "HG-BOT-03", title: "Steel Bottle", price: 3400, currency: "usd" },
  ]);
  const files = buildCommerceShipFiles({
    title: "Harbor Goods",
    productsLiteral: harborLiteral,
  });
  const catalog = files.find((f) => f.path === "lib/catalog.ts")!.content;
  assert.ok(catalog.includes("Canvas Tote"), "catalog has Canvas Tote");
  assert.ok(catalog.includes("Field Notebook"), "catalog has Field Notebook");
  assert.ok(catalog.includes("Steel Bottle"), "catalog has Steel Bottle");
  assert.ok(catalog.includes("HG-BOT-03"), "catalog keeps the Steel Bottle SKU");
  assert.ok(catalog.includes('"price":3400') || catalog.includes('3400'), "catalog keeps $34 as cents");
  assert.ok(!catalog.includes("brass-lamp"), "no invented brass lamp");
  assert.ok(!catalog.includes("camp-blanket"), "no invented camp blanket");

  const assets = files.filter((f) => f.path.startsWith("public/products/"));
  const assetNames = assets.map((f) => f.path).sort();
  assert.deepEqual(
    assetNames,
    [
      "public/products/canvas-tote.svg",
      "public/products/field-notebook.svg",
      "public/products/steel-bottle.svg",
    ].sort(),
    "asset manifest is exactly the wizard products, no extras: " + assetNames.join(",")
  );
  assert.ok(!assets.some((f) => f.path.includes("brass-lamp")), "no brass-lamp asset");
  assert.ok(!assets.some((f) => f.path.includes("camp-blanket")), "no camp-blanket asset");
}

{
  // Tolerant parse: model-emitted JS with unquoted keys still yields the
  // right slugs (no Northline fallback when the literal is JS, not JSON).
  const jsLiteral = `[{ id: "canvas-tote", sku: "HG-TOTE-01", title: "Canvas Tote", price: 4200 }, { sku: "HG-NOTE-02", title: "Field Notebook", price: 1800 }]`;
  const files = buildCommerceShipFiles({
    title: "Harbor Goods",
    productsLiteral: jsLiteral,
  });
  const assets = files.filter((f) => f.path.startsWith("public/products/"));
  const names = assets.map((f) => f.path).sort();
  assert.ok(
    names.includes("public/products/canvas-tote.svg"),
    "JS literal yields canvas-tote asset"
  );
  assert.ok(
    names.includes("public/products/hg-note-02.svg"),
    "sku-only product yields sku-named asset"
  );
  assert.ok(!names.some((n) => n.includes("brass-lamp")), "no Northline leak on JS literal");
}

{
  // Visual bar: product placeholder cards are category-aware, deterministic,
  // and never inject raw titles into the SVG.
  const literal = JSON.stringify([
    { id: "steel-bottle", sku: "HG-BOT-03", title: "Steel Bottle" },
    { id: "canvas-tote", sku: "HG-TOTE-01", title: "Canvas Tote" },
    { id: "trail-mug", sku: "HG-MUG-02", title: "Enamel Camp Mug" },
    { id: "mystery", sku: "HG-MYS-13", title: 'Mystery Item <b>"quoted"</b>' },
  ]);
  const opts = { title: "Harbor Goods", productsLiteral: literal };
  const files = buildCommerceShipFiles(opts);
  const assets = files.filter((f) => f.path.startsWith("public/products/"));
  assert.equal(assets.length, 4, "one asset per wizard product");
  for (const a of assets) {
    assert.ok(a.content.startsWith("<svg"), `${a.path} is an SVG document`);
    assert.ok(a.content.includes('viewBox="0 0 640 800"'), `${a.path} keeps the 4:5 canvas`);
    assert.ok(a.content.includes("<linearGradient"), `${a.path} has a gradient backdrop`);
  }
  const bySlug = new Map(assets.map((a) => [a.path, a.content]));
  const bottle = bySlug.get("public/products/steel-bottle.svg")!;
  assert.ok(!bottle.includes("<text"), "bottle silhouette carries no monogram text");
  assert.ok(bottle.includes('rx="9"'), "bottle keeps its cap detail");
  const parcel = bySlug.get("public/products/mystery.svg")!;
  assert.ok(parcel.includes(">MI<"), "unknown category falls back to parcel with MI mark");
  assert.ok(!parcel.includes("<b>"), "raw title HTML is never injected into the SVG");
  assert.ok(!parcel.includes('"quoted"'), "raw title text is never injected into the SVG");
  // Hostile monogram: a title whose initials contain markup chars must be
  // sanitized, never interpolated raw into the <text> node.
  const hostile = buildCommerceShipFiles({
    title: "X",
    productsLiteral: JSON.stringify([{ id: "evil", sku: "EV-1", title: "<b>Bold" }]),
  })
    .find((f) => f.path === "public/products/evil.svg")!.content;
  assert.ok(!hostile.includes("<b>"), "monogram strips markup characters");
  assert.ok(hostile.includes(">B<"), "monogram keeps the safe initial");
  // Deterministic: identical input yields byte-identical assets.
  const again = buildCommerceShipFiles(opts).filter((f) =>
    f.path.startsWith("public/products/")
  );
  assert.deepEqual(
    again.map((f) => f.content),
    assets.map((f) => f.content),
    "placeholder cards are deterministic"
  );
}

console.log("commerce codegen tests: all passed");
