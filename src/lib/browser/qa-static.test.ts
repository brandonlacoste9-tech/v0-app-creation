/**
 * Run: npx tsx src/lib/browser/qa-static.test.ts
 */
import assert from "node:assert/strict";
import { finalizeQaScore, mergeLiveIntoReport, runStaticPreviewQa } from "./qa-static";

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

const compiledFail = mergeLiveIntoReport(polished, {
  rootEmpty: true,
  consoleErrors: ["'return' outside of function"],
});
assert.ok(compiledFail.score <= 50, "non-compiling preview cannot score Good");
assert.ok(!compiledFail.ok, "non-compiling preview is not ok");
assert.ok(
  compiledFail.findings.some((f) => f.severity === "error"),
  "live compile failure is an error finding"
);
assert.ok(
  compiledFail.findings.some(
    (f) =>
      f.message.includes("'return' outside of function") &&
      f.category === "render"
  ),
  "runtime message is in the QA finding, not only a count"
);
const stacked = mergeLiveIntoReport(polished, {
  rootEmpty: true,
  consoleErrors: [
    "PRODUCTS is not defined\nComponent stack:\n    at ProductGrid\nStack:\n    at render",
  ],
});
assert.ok(
  stacked.findings.some(
    (f) =>
      f.message.includes("PRODUCTS is not defined") &&
      f.message.includes("Component stack:") &&
      f.message.includes("Stack:")
  ),
  "QA surfaces message, component stack, and stack"
);

const streetBare = runStaticPreviewQa(`function Component() {
  const PRODUCTS = [{ sku: "A", title: "Tote", price: 4200 }];
  return (
    <main>
      <h1 className="text-5xl">Shop</h1>
      <section className="store-contrast">
        <div className="store-contrast-inner aspect-[4/5]">ok</div>
      </section>
    </main>
  );
}
"canvas-tote": <svg viewBox="0 0 80 100"></svg>
`);
assert.ok(
  streetBare.findings.some((f) => f.id === "bare_jsx_entry"),
  "flags bare svg object entry"
);
assert.ok(!streetBare.ok, "bare jsx entry is not Excellent");
assert.ok(streetBare.score <= 72, "cannot score 100 with a compile error");

// Unbound field reads — the v0 Harbor Goods bug class: {product.number} with
// no `number` in the data array renders empty, no error, no warning.
const harbor = runStaticPreviewQa(`function Component() {
  const products = [{ name: "Canvas Tote", price: 42 }];
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      {products.map((p) => (
        <div key={p.name}>
          <span>{p.number}</span>
          <span>{p.name}</span>
          <span>{p.price}</span>
        </div>
      ))}
    </main>
  );
}`);
const harborUnbound = harbor.findings.filter((f) => f.id === "unbound_field");
assert.equal(
  harborUnbound.length,
  1,
  "exactly one unbound field flagged, got: " +
    harborUnbound.map((f) => f.message).join(" | ")
);
assert.ok(harborUnbound[0].message.includes("p.number"), "flags the p.number read");
assert.ok(harborUnbound[0].message.includes('"number"'), "names the missing key");
assert.equal(harborUnbound[0].severity, "warning", "unbound field is a warning");
assert.equal(harborUnbound[0].category, "content", "unbound field is content");

const harborClean = runStaticPreviewQa(`function Component() {
  const products = [{ name: "Canvas Tote", price: 42, image: { src: "/tote.png", alt: "Tote" } }];
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      {products.map((p) => (
        <div key={p.name}>
          <img src={p.image.src} alt={p.image.alt} />
          <span>{p.name}</span>
          <span>{p.price}</span>
          <span>{p.name.trim()}</span>
          <span>{p?.name}</span>
          <span>{p["price"]}</span>
        </div>
      ))}
      {products.map(({ name, price }) => (
        <div key={name}>{name} — {price}</div>
      ))}
      <span>{products[0].name}</span>
    </main>
  );
}`);
assert.ok(
  !harborClean.findings.some((f) => f.id === "unbound_field"),
  "defined reads stay silent (nested, ?. , method calls, p[lit], destructuring, indexed): " +
    harborClean.findings
      .filter((f) => f.id === "unbound_field")
      .map((f) => f.message)
      .join(" | ")
);

const harborNested = runStaticPreviewQa(`function Component() {
  const products = [{ name: "Canvas Tote", image: { src: "/tote.png" } }];
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      {products.map((p) => (
        <div key={p.name}>
          <img src={p.image.src} alt={p.image.alt} />
          <span>{p?.caption}</span>
        </div>
      ))}
      {products.map(({ sku }) => (
        <div key={sku}>{sku}</div>
      ))}
    </main>
  );
}`);
const nestedUnbound = harborNested.findings.filter(
  (f) => f.id === "unbound_field"
);
assert.equal(
  nestedUnbound.length,
  3,
  "flags p.image.alt, p?.caption, and destructured sku — got: " +
    nestedUnbound.map((f) => f.message).join(" | ")
);
assert.ok(
  nestedUnbound.some(
    (f) => f.message.includes('"alt"') && f.message.includes("p.image.alt")
  ),
  "nested read flags only the missing alt segment"
);
assert.ok(
  nestedUnbound.some((f) => f.message.includes('"caption"')),
  "optional chaining does not excuse a missing key"
);
assert.ok(
  nestedUnbound.some((f) => f.message.includes('"sku"')),
  "destructured missing key is a read"
);

// ---- Batch 2: placeholder_contact ----
const v0Contact = runStaticPreviewQa(`function Component() {
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      <footer>
        <a href="mailto:hello@harborgoods.example">hello@harborgoods.example</a>
        <p>Questions? Call (555) 013-4321</p>
      </footer>
    </main>
  );
}`);
const pcFindings = v0Contact.findings.filter(
  (f) => f.id === "placeholder_contact"
);
assert.equal(
  pcFindings.length,
  2,
  "flags the example email and the 555 phone, got: " +
    pcFindings.map((f) => f.message).join(" | ")
);
assert.ok(
  pcFindings.some((f) => f.message.includes("hello@harborgoods.example")),
  "names the placeholder email"
);
assert.ok(
  pcFindings.every((f) => f.severity === "warning" && f.category === "content"),
  "placeholder_contact is warning/content"
);

const loremContact = runStaticPreviewQa(`function Component() {
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      <p>lorem ipsum dolor sit amet</p>
    </main>
  );
}`);
assert.ok(
  loremContact.findings.some((f) => f.id === "placeholder_contact"),
  "flags lorem ipsum as placeholder content"
);

const realContact = runStaticPreviewQa(`function Component() {
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      <footer>
        <a href="mailto:hello@harborgoods.com">hello@harborgoods.com</a>
        <p>Questions? Call (514) 482-1234</p>
      </footer>
    </main>
  );
}`);
assert.ok(
  !realContact.findings.some((f) => f.id === "placeholder_contact"),
  "real contact info stays silent: " +
    realContact.findings
      .filter((f) => f.id === "placeholder_contact")
      .map((f) => f.message)
      .join(" | ")
);

// ---- Batch 2: display_field_key ----
const badKey = runStaticPreviewQa(`function Component() {
  const products = [{ name: "Tote", sku: "A", price: 42 }];
  return (
    <main>
      <h1 className="text-5xl">Shop</h1>
      {products.map((product) => (
        <div key={product.name}>{product.name}</div>
      ))}
    </main>
  );
}`);
const dkFindings = badKey.findings.filter(
  (f) => f.id === "display_field_key"
);
assert.equal(
  dkFindings.length,
  1,
  "flags key={product.name}, got: " +
    dkFindings.map((f) => f.message).join(" | ")
);
assert.ok(
  dkFindings[0].message.includes("key={product.name}"),
  "names the unstable key"
);
assert.equal(dkFindings[0].severity, "warning", "display_field_key is a warning");
assert.equal(dkFindings[0].category, "structure", "display_field_key is structure");

const goodKey = runStaticPreviewQa(`function Component() {
  const products = [{ name: "Tote", sku: "A", price: 42 }];
  return (
    <main>
      <h1 className="text-5xl">Shop</h1>
      {products.map((product) => (
        <div key={product.sku}>{product.name}</div>
      ))}
      {products.map((p, index) => (
        <span key={index}>{p.name}</span>
      ))}
    </main>
  );
}`);
assert.ok(
  !goodKey.findings.some((f) => f.id === "display_field_key"),
  "key={product.sku} and key={index} stay silent"
);

// ---- Batch 2: dead_type_hack ----
const typeHack = runStaticPreviewQa(`function Component() {
  const products = [{ name: "Tote", price: 42 }];
  type Product = (typeof products)[number];
  void (null as Product | null);
  return (
    <main>
      <h1 className="text-5xl">Shop</h1>
    </main>
  );
}`);
const dhFindings = typeHack.findings.filter(
  (f) => f.id === "dead_type_hack"
);
assert.equal(
  dhFindings.length,
  1,
  "flags only the void (...) silencer, got: " +
    dhFindings.map((f) => f.message).join(" | ")
);
assert.ok(
  dhFindings[0].message.includes("void"),
  "names the void expression"
);
assert.ok(
  dhFindings.every((f) => f.severity === "info" && f.category === "structure"),
  "dead_type_hack is info/code"
);

const deadType = runStaticPreviewQa(`function Component() {
  type UnusedShape = { label: string };
  return (
    <main>
      <h1 className="text-5xl">Shop</h1>
    </main>
  );
}`);
const dtFindings = deadType.findings.filter(
  (f) => f.id === "dead_type_hack"
);
assert.equal(
  dtFindings.length,
  1,
  "flags the unreferenced type, got: " +
    dtFindings.map((f) => f.message).join(" | ")
);
assert.ok(dtFindings[0].message.includes("UnusedShape"), "names the dead type");

const liveType = runStaticPreviewQa(`function Component() {
  type Product = { name: string };
  const p: Product = { name: "Tote" };
  return (
    <main>
      <h1 className="text-5xl">Shop</h1>
      <p>{p.name}</p>
    </main>
  );
}`);
assert.ok(
  !liveType.findings.some((f) => f.id === "dead_type_hack"),
  "referenced type stays silent"
);

// ---- Batch 2: unformatted_price ----
const v0Price = runStaticPreviewQa(
  "function Component() {\n" +
    '  const products = [{ name: "Tote", sku: "A", price: 42 }];\n' +
    "  return (\n" +
    "    <main>\n" +
    '      <h1 className="text-5xl">Shop</h1>\n' +
    "      {products.map((p) => (\n" +
    '        <div key={p.sku}>\n' +
    '          <span>{"$" + p.price}</span>\n' +
    "          <span>" +
    "{`$" +
    "{p.price}`}</span>\n" +
    "        </div>\n" +
    "      ))}\n" +
    "    </main>\n" +
    "  );\n" +
    "}"
);
const upFindings = v0Price.findings.filter(
  (f) => f.id === "unformatted_price"
);
assert.equal(
  upFindings.length,
  2,
  "flags both the \"$\" + concat and the `${p.price}` template, got: " +
    upFindings.map((f) => f.message).join(" | ")
);
assert.ok(
  upFindings.every((f) => f.severity === "warning" && f.category === "content"),
  "unformatted_price is warning/content"
);

const fmtPrice = runStaticPreviewQa(
  "function Component() {\n" +
    '  const products = [{ name: "Tote", sku: "A", price: 4200 }];\n' +
    "  return (\n" +
    "    <main>\n" +
    '      <h1 className="text-5xl">Shop</h1>\n' +
    "      {products.map((p) => (\n" +
    '        <div key={p.sku}><span>{formatMoney(p.price)}</span></div>\n' +
    "      ))}\n" +
    "    </main>\n" +
    "  );\n" +
    "}"
);
assert.ok(
  !fmtPrice.findings.some((f) => f.id === "unformatted_price"),
  "formatMoney(p.price) stays silent"
);

// ---- Batch 2: missing_email_capture ----
const noCapture = runStaticPreviewQa(`function Component() {
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      <p>Beautiful goods.</p>
    </main>
  );
}`);
const mcFindings = noCapture.findings.filter(
  (f) => f.id === "missing_email_capture"
);
assert.equal(
  mcFindings.length,
  1,
  "exactly one finding when no email capture exists, got: " + mcFindings.length
);
assert.equal(mcFindings[0].severity, "info", "missing_email_capture is info");
assert.equal(mcFindings[0].category, "content", "missing_email_capture is content");

const hasCapture = runStaticPreviewQa(`function Component() {
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      <form>
        <label>Email</label>
        <input type="email" name="email" />
        <button type="submit">Join</button>
      </form>
    </main>
  );
}`);
assert.ok(
  !hasCapture.findings.some((f) => f.id === "missing_email_capture"),
  "proper email input stays silent"
);

const labelCapture = runStaticPreviewQa(`function Component() {
  return (
    <main>
      <h1 className="text-5xl">Harbor Goods</h1>
      <form>
        <label>Subscribe to our newsletter</label>
        <input type="text" name="newsletter" />
        <button type="submit">Join</button>
      </form>
    </main>
  );
}`);
assert.ok(
  !labelCapture.findings.some((f) => f.id === "missing_email_capture"),
  "newsletter label stays silent"
);

console.log("qa-static tests: all passed");
