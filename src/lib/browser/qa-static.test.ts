/**
 * Run: npx tsx src/lib/browser/qa-static.test.ts
 */
import assert from "node:assert/strict";
import { finalizeQaScore, runStaticPreviewQa } from "./qa-static";

const timidStore = `function Component() {
  const PRODUCTS = [{ sku: "A", title: "Tote", price: 4200 }];
  return (
    <main>
      <h1 className="text-2xl">Shop</h1>
      <button type="button" onClick={() => createCheckoutSession({ sku: "A", quantity: 1 })}>
        {formatMoney(4200)}
      </button>
    </main>
  );
}`;
const timid = runStaticPreviewQa(timidStore);
assert.ok(
  timid.findings.some((f) => f.id === "timid_type"),
  "flags timid store type"
);
assert.ok(timid.score <= 80, "design fail caps score at 80");
assert.ok(
  timid.findings.some((f) => f.id === "no_image_slot"),
  "flags missing 4:5 slot"
);
assert.ok(
  timid.findings.some((f) => f.id === "no_contrast_band"),
  "flags missing store-contrast"
);

const polishedStore = `function Component() {
  const PRODUCTS = [{ sku: "A", title: "Tote", price: 4200 }];
  return (
    <main className="bg-white">
      <nav className="sticky top-0">Northline</nav>
      <h1 className="text-5xl md:text-7xl tracking-[-0.04em] font-semibold">
        Everyday carry<span className="text-[#E24A2A]">.</span>
      </h1>
      <section className="store-contrast w-full bg-zinc-950 text-zinc-50 py-20 md:py-28">
        <div className="store-contrast-inner mx-auto max-w-7xl px-6 md:px-8">
        <p>03 OBJECTS / 01 COLLECTION</p>
        <div className="grid grid-cols-1 md:grid-cols-3">
          <article>
            <div className="aspect-[4/5] overflow-hidden">
              <svg viewBox="0 0 80 100" className="hover:scale-[1.03]" />
            </div>
            <p>01</p>
            <button type="button" className="hover:bg-zinc-900">
              {formatMoney(4200)}
            </button>
          </article>
        </div>
        </div>
      </section>
      <button type="button" className="hover:bg-black" onClick={() => createCheckoutSession({ sku: "A", quantity: 1 })}>
        Buy
      </button>
    </main>
  );
}`;
const polished = runStaticPreviewQa(polishedStore);
assert.ok(
  !polished.findings.some((f) => f.category === "design" && f.severity === "warning"),
  "polished store has no design warnings: " +
    polished.findings.filter((f) => f.category === "design").map((f) => f.id).join(",")
);

const cap = finalizeQaScore([
  {
    id: "timid_type",
    severity: "warning",
    category: "design",
    message: "timid",
  },
]);
assert.equal(cap.score, 80, "single design warning caps at 80 not 90");

const landing = runStaticPreviewQa(`function Component() {
  return (
    <div className="min-h-screen">
      <nav>Acme</nav>
      <h1 className="text-4xl">Hello</h1>
      <button type="button">Start free</button>
    </div>
  );
}`);
assert.ok(
  !landing.findings.some((f) => f.category === "design"),
  "non-store landing is not scored as a storefront"
);

console.log("qa-static tests: all passed");
