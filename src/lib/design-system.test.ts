/**
 * Run: npx tsx src/lib/design-system.test.ts
 */
import assert from "node:assert/strict";
import {
  DESIGN_ANTI_PATTERNS,
  DESIGN_STYLES,
  SHIPBOARD_SIGNATURES,
  STOREFRONT_LAWS,
  STOREFRONT_STYLE_IDS,
  getDesignStyle,
  hasDisplayScale,
  isStorefrontStyle,
  missingStorefrontSections,
} from "./design-system";

assert.equal(STOREFRONT_STYLE_IDS.length, 3, "three storefront styles");
assert.ok(SHIPBOARD_SIGNATURES.length >= 2, "at least two signatures");
assert.ok(STOREFRONT_LAWS.includes("aspect-[4/5]"), "card aspect in laws");
assert.ok(STOREFRONT_LAWS.includes("generate_image"), "existing Imagine path, no third-party");
assert.ok(/fake reviews|Sarah M/i.test(DESIGN_ANTI_PATTERNS), "commerce fake-review ban");
assert.ok(/hero carousels/i.test(DESIGN_ANTI_PATTERNS), "carousel ban");

for (const id of STOREFRONT_STYLE_IDS) {
  assert.ok(isStorefrontStyle(id), id);
  const style = getDesignStyle(id);
  assert.equal(style.id, id, `style ${id} exists`);
  const missing = missingStorefrontSections(style);
  assert.deepEqual(missing, [], `${id} recipe missing: ${missing.join(", ")}`);
  assert.ok(hasDisplayScale(style), `${id} defines text-5xl+ display scale`);
  assert.ok(/period/i.test(style.typography), `${id} accent-period rule`);
  assert.ok(/01\/02\/03/.test(style.typography) || /01\/02\/03/.test(style.recipe), `${id} editorial numbering`);
  assert.ok(/contrast/i.test(style.recipe), `${id} contrast band`);
  assert.ok(/#E24A2A/.test(style.palette) || /#E24A2A/.test(style.recipe), `${id} Shipboard hairline`);
}

assert.equal(DESIGN_STYLES.filter((s) => isStorefrontStyle(s.id)).length, 3);
assert.ok(!isStorefrontStyle("minimal"), "minimal stays a general style");

console.log("design-system tests: all passed");
