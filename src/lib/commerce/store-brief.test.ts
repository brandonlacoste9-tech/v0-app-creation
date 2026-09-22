/**
 * Run: npx tsx src/lib/commerce/store-brief.test.ts
 */
import assert from "node:assert/strict";
import { extractProductsArrayLiteral } from "./preview";
import {
  buildStoreBrief,
  buildStoreUserPrompt,
  parsePriceToCents,
  productsLiteral,
  StoreBriefError,
} from "./store-brief";

function throws(fn: () => void, re: RegExp, msg: string) {
  try {
    fn();
    throw new Error(msg);
  } catch (err) {
    assert.ok(err instanceof StoreBriefError, msg + " (type)");
    assert.ok(re.test(err.message), msg + ` got: ${err.message}`);
  }
}

throws(() => parsePriceToCents(0), /greater than 0/, "reject zero");
throws(() => parsePriceToCents(-1), /greater than 0/, "reject negative");
throws(() => parsePriceToCents("abc"), /greater than 0/, "reject non-numeric");
throws(() => parsePriceToCents(""), /required|greater than 0/, "reject empty");

assert.equal(parsePriceToCents("18"), 1800, "$18 as dollars");
assert.equal(parsePriceToCents(18), 1800, "number 18 as dollars");
assert.equal(parsePriceToCents("18.50"), 1850, "decimals");
assert.equal(parsePriceToCents("$24"), 2400, "strip $");
assert.equal(parsePriceToCents("1800"), 1800, "integer >= 1000 is cents");

throws(
  () => buildStoreBrief({ storeName: "", products: [{ name: "Mug", price: 24 }] }),
  /Store name/,
  "name required"
);
throws(
  () => buildStoreBrief({ storeName: "Cafe", products: [] }),
  /at least one product/,
  "min 1 product"
);
throws(
  () =>
    buildStoreBrief({
      storeName: "Cafe",
      products: [{ name: "Mug", price: 0 }],
    }),
  /greater than 0/,
  "zero price on product"
);

const brief = buildStoreBrief({
  storeName: "Cloud Nine Coffee",
  tagline: "Roast you can taste",
  vibe: "minimal",
  products: [
    { name: "Ember Roast", price: "18", description: "House espresso blend" },
    { name: "Cloud Nine Mug", price: 24, description: "12oz ceramic" },
    { name: "Trail Blend Kit", price: "42.00" },
  ],
});
assert.equal(brief.designStyle, "clean");
assert.equal(brief.vibe, "clean");
assert.equal(brief.products[0].priceCents, 1800);
assert.equal(brief.products[1].priceCents, 2400);
assert.equal(brief.products[2].priceCents, 4200);

const lit = productsLiteral(brief);
assert.ok(lit.includes("Ember Roast"), "title in literal");
assert.ok(lit.includes('"price": 1800'), "cents in literal");
assert.ok(!lit.includes("brass-lamp"), "no placeholder SKUs");

const src = `const PRODUCTS = ${lit};\nfunction Component() { return <h1>{PRODUCTS[0].title}</h1>; }`;
const extracted = extractProductsArrayLiteral(src);
assert.ok(extracted, "round-trips through extractProductsArrayLiteral");
assert.ok(extracted!.includes("Ember Roast"));
assert.ok(extracted!.includes("Cloud Nine Mug"));
assert.ok(extracted!.includes("Trail Blend Kit"));

const prompt = buildStoreUserPrompt(brief);
assert.ok(prompt.includes("const PRODUCTS"));
assert.ok(prompt.includes("Ember Roast"));
assert.ok(!prompt.includes("/products/brass"), "no placeholder SVG filenames");

assert.equal(
  buildStoreBrief({ storeName: "X", vibe: "bold", products: [{ name: "A", price: 9 }] })
    .designStyle,
  "street",
  "Bold → street"
);
assert.equal(
  buildStoreBrief({ storeName: "X", vibe: "playful", products: [{ name: "A", price: 9 }] })
    .designStyle,
  "atelier",
  "Playful → atelier"
);
assert.equal(
  buildStoreBrief({ storeName: "X", vibe: "atelier", products: [{ name: "A", price: 9 }] })
    .designStyle,
  "atelier",
  "Atelier → atelier"
);
assert.ok(prompt.includes("OBJECTS"), "editorial collection header");
assert.ok(prompt.includes("aspect-[4/5]"), "reserved image slots");

console.log("store-brief tests: all passed");
