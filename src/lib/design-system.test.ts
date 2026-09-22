/**
 * Run: npx tsx src/lib/design-system.test.ts
 */
import assert from "node:assert/strict";
import {
  CONTRAST_BAND_INNER,
  DESIGN_ANTI_PATTERNS,
  DESIGN_STYLES,
  SHIPBOARD_SIGNATURES,
  STOREFRONT_CONTRAST_BAND,
  STOREFRONT_LAWS,
  STOREFRONT_STYLE_IDS,
  contrastBandClass,
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
  assert.ok(style.contrastBand, `${id} contrastBand classes`);
  assert.equal(
    style.contrastBand,
    STOREFRONT_CONTRAST_BAND[id],
    `${id} contrastBand matches table`
  );
  assert.ok(/\bstore-contrast\b/.test(style.contrastBand!), `${id} store-contrast token`);
  assert.ok(/\b(bg-zinc-950|bg-black|bg-\[#1C1917\])/.test(style.contrastBand!), `${id} dark fill`);
  assert.ok(/\bpy-(16|20)\b/.test(style.contrastBand!), `${id} vertical padding`);
  assert.ok(/#E24A2A/.test(style.palette) || /#E24A2A/.test(style.recipe), `${id} Shipboard hairline`);
}

assert.ok(/\bstore-contrast-inner\b/.test(CONTRAST_BAND_INNER), "inner wrap token");
assert.equal(contrastBandClass("clean"), STOREFRONT_CONTRAST_BAND.clean);
assert.equal(contrastBandClass("unknown"), STOREFRONT_CONTRAST_BAND.clean);
assert.ok(STOREFRONT_LAWS.includes("store-contrast"), "laws name the class");

assert.equal(DESIGN_STYLES.filter((s) => isStorefrontStyle(s.id)).length, 3);
assert.ok(!isStorefrontStyle("minimal"), "minimal stays a general style");

console.log("design-system tests: all passed");
