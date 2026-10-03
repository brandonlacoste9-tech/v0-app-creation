/**
 * Truncation-risk estimator unit tests (tsx runner).
 * Run: npx tsx src/lib/truncation-risk.test.ts
 */
import {
  buildStoreBrief,
  buildStoreUserPrompt,
} from "./commerce/store-brief";
import {
  countRequestedFiles,
  estimateTruncationRisk,
  ESTIMATE_HEADROOM,
  TOKENS_PER_CATALOG_PRODUCT,
  TOKENS_PER_FILE,
} from "./truncation-risk";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}

// FILE n/m format takes the total
assert(countRequestedFiles("FILE 1/15\nbuild the hero") === 15, "FILE 1/15 -> 15");
assert(countRequestedFiles("file 3 of 12 please") === 12, "file 3 of 12 -> 12");

// Fenced file headers are counted
{
  const p = [
    "```tsx // src/components/Hero.tsx",
    "code",
    "```",
    "```tsx // src/components/Footer.tsx",
    "code",
    "```",
  ].join("\n");
  assert(countRequestedFiles(p) === 2, "two fenced headers -> 2");
}

// 'N files' / 'N-page' phrasing
assert(countRequestedFiles("build a 15 files store") === 15, "'15 files' -> 15");
assert(countRequestedFiles("12-page brief for the shop") === 12, "'12-page' -> 12");

// Tiny counts are not build sizes
assert(countRequestedFiles("split into 2 files") === 0, "'2 files' -> 0");

// Path-like .tsx mentions
assert(
  countRequestedFiles("edit src/components/Hero.tsx and src/components/Nav.tsx") === 2,
  "two path mentions -> 2"
);

// Max across patterns
assert(countRequestedFiles("FILE 1/15\ntouch src/a.tsx") === 15, "max across patterns");

// Named multi-file lists (the store wizard brief footer) are counted
{
  const p =
    "Build the store.\n\nMulti-file: Header, ProductGrid, ProductDetail, Footer, Component. Every file defines its component as function <Name>().";
  assert(countRequestedFiles(p) === 5, "multi-file list -> 5");
}
// A lone component mention may be prose — not a file list
assert(
  countRequestedFiles("Multi-file: it will be great.") === 0,
  "non-list multi-file mention -> 0"
);
// Trailing punctuation on list items is stripped, not dropped
assert(
  countRequestedFiles("Multi-file: Header, ProductGrid, Footer;") === 3,
  "punctuated multi-file list -> 3"
);
// The list pattern must not fire on the prompt-helper template
assert(
  countRequestedFiles(
    "Build a polished UI. If multi-section: split into files (Navbar, Hero, etc.)."
  ) === 0,
  "prompt-helper template still -> 0"
);
// The wizard footer beats the single src/Component.tsx path mention
{
  const p =
    "Emit this catalog ONCE (src/Component.tsx or a sibling src/ file).\n\nMulti-file: Header, ProductGrid, ProductDetail, Footer, Component.";
  assert(countRequestedFiles(p) === 5, "max: multi-file list over path mention");
}

// Plain small prompts -> 0 (no false positive on the prompt-helper template)
assert(countRequestedFiles("build me a landing page") === 0, "small prompt -> 0");
assert(
  countRequestedFiles(
    "Build a polished UI. If multi-section: split into files (Navbar, Hero, etc.)."
  ) === 0,
  "prompt-helper template -> 0"
);

// 15-file brief at 16k -> high, suggests a higher tier (with headroom)
{
  const r = estimateTruncationRisk("FILE 1/15\n" + "x".repeat(500), 16384);
  assert(r.risk === "high", "15 files at 16k -> high risk");
  assert(r.requestedFiles === 15, "requestedFiles 15");
  assert(
    r.estimatedTokens === Math.ceil(15 * TOKENS_PER_FILE * ESTIMATE_HEADROOM),
    "estimate = files * per-file * headroom"
  );
  assert(r.suggestedTokens > 16384, "suggested tier above 16k");
}

// Backlog #3 accept: a 12-file build warns below realistic output size
{
  const r = estimateTruncationRisk(
    "Build a 12-file storefront. Multi-file: Header, ProductGrid, ProductDetail, Footer, Component, Cart, Search, Checkout, Admin, Orders, Policies, Newsletter.",
    16384
  );
  assert(r.requestedFiles === 12, "12 named files counted");
  assert(r.estimatedTokens === Math.ceil(12 * TOKENS_PER_FILE * ESTIMATE_HEADROOM), "12-file estimate");
  assert(r.estimatedTokens === 18000, "12-file estimate is 18k with headroom");
  assert(r.risk === "high", "12 files at 16k -> high risk (was silently low)");
  assert(r.suggestedTokens === 24576, "next tier above 18k is 24k");
}

// Small prompt -> low
{
  const r = estimateTruncationRisk("build me a landing page", 16384);
  assert(r.risk === "low", "small prompt -> low risk");
}

// Fits inside budget -> low
{
  const r = estimateTruncationRisk("FILE 1/8\nbuild", 16384);
  assert(r.risk === "low", "8 files at 16k -> low risk");
}

// Suggested tier covers the estimate
{
  const r = estimateTruncationRisk("build 20 files please", 16384);
  assert(r.suggestedTokens >= r.estimatedTokens, "suggested covers estimate");
}

// Structured context: catalog size re-emitted in the code
{
  const r = estimateTruncationRisk("Multi-file: Header, ProductGrid, ProductDetail, Footer, Component.", 16384, {
    catalogSize: 10,
  });
  const expected = Math.ceil(
    (5 * TOKENS_PER_FILE + 10 * TOKENS_PER_CATALOG_PRODUCT) * ESTIMATE_HEADROOM
  );
  assert(r.requestedFiles === 5, "structured: 5 named files");
  assert(r.estimatedTokens === expected, "structured: files + catalog + headroom");
  assert(r.estimatedTokens === 9000, "5 files + 10 products = 9k with headroom");
  assert(r.risk === "low", "guided store with a small catalog fits 16k");
}

// Structured context: existing source re-emitted on updates
{
  // A follow-up message on a large project: the prompt names no files, but
  // the update re-emits ~40k chars of existing source.
  const r = estimateTruncationRisk("add a testimonial section", 16384, {
    existingSourceChars: 40000,
  });
  assert(r.estimatedTokens === Math.ceil((40000 / 4) * ESTIMATE_HEADROOM), "structured: existing source + headroom");
  assert(r.estimatedTokens === 12500, "40k chars of source = 12.5k tokens");
  assert(r.risk === "low", "12.5k estimate fits the 16k budget");
  const tight = estimateTruncationRisk("add a testimonial section", 8192, {
    existingSourceChars: 40000,
  });
  assert(tight.risk === "high", "update re-emitting 40k chars warns at 8k");
}

// Structured expectedFiles wins when the prompt undercounts
{
  const r = estimateTruncationRisk("touch src/a.tsx", 16384, {
    expectedFiles: 9,
  });
  assert(r.requestedFiles === 9, "structured expectedFiles overrules prompt");
}

// Garbage structured inputs never inflate or crash the estimate
{
  const r = estimateTruncationRisk("build me a landing page", 16384, {
    expectedFiles: NaN,
    catalogSize: -3,
    existingSourceChars: Infinity,
  });
  assert(r.estimatedTokens === 0, "garbage structured inputs -> zero estimate");
  assert(r.risk === "low", "no signal -> low risk");
}

// Evidence replay (backlog #3): the guided store prompt that the old
// estimator counted as 1 file / 1,200 tokens.
{
  const brief = buildStoreBrief({
    storeName: "Demo Shop",
    tagline: "Great goods",
    vibe: "clean",
    products: [
      { name: "Chair", price: 99, description: "A fine chair" },
      { name: "Table", price: 199, description: "A fine table" },
      { name: "Lamp", price: 49, description: "A fine lamp" },
      { name: "Sofa", price: 499, description: "A fine sofa" },
      { name: "Shelf", price: 149, description: "A fine shelf" },
      { name: "Rug", price: 89, description: "A fine rug" },
      { name: "Desk", price: 299, description: "A fine desk" },
      { name: "Stool", price: 59, description: "A fine stool" },
    ],
  });
  const prompt = buildStoreUserPrompt(brief);
  assert(
    countRequestedFiles(prompt) === 5,
    "evidence replay: guided store counts 5 files, not 1"
  );
  const r = estimateTruncationRisk(prompt, 16384, {
    catalogSize: brief.products.length,
  });
  assert(
    r.requestedFiles === 5,
    "evidence replay: structured estimate sees 5 files"
  );
  const expected = Math.ceil(
    (5 * TOKENS_PER_FILE + 8 * TOKENS_PER_CATALOG_PRODUCT) *
      ESTIMATE_HEADROOM
  );
  assert(r.estimatedTokens === expected, "evidence replay: estimate honest");
  assert(r.estimatedTokens === 8700, "evidence replay: 8.7k, not 1.2k");
  assert(r.risk === "low", "evidence replay: honest estimate still fits 16k");
}

console.log("All truncation-risk tests passed.");
