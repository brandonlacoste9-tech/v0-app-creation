/**
 * Lightweight integrity unit tests (node --import tsx or tsx runner).
 * Run: npx tsx src/lib/gen-integrity.test.ts
 */
import {
  getShipReadyUi,
  validateForShip,
  validateGeneration,
} from "./gen-integrity";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Empty
{
  const r = validateGeneration("Sure, here you go!");
  assert(!r.ok, "empty should fail");
  assert(r.issues.some((i) => i.code === "no_code"), "no_code");
}

// Placeholder
{
  const r = validateGeneration(`Built it.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return <div>[Previous content remains the same...]</div>;
}
\`\`\`
`);
  assert(!r.ok, "placeholder should fail");
  assert(
    r.issues.some((i) => i.code === "placeholder_previous"),
    "placeholder_previous"
  );
}

// Good single file
{
  const r = validateGeneration(`Waitlist ready.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  const [email, setEmail] = useState("");
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-4xl font-bold">Join the waitlist</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="border px-3 py-2" />
        <button type="submit" className="bg-white text-black px-4 py-2">Join</button>
      </form>
    </div>
  );
}
\`\`\`
`);
  assert(r.ok, "good gen should pass");
  assert(r.issues.filter((i) => i.severity === "error").length === 0, "no errors");
}

// Multi-file good
{
  const r = validateGeneration(`Multi.
\`\`\`tsx file="src/Hero.tsx"
function Hero() {
  return <section className="py-24"><h1 className="text-5xl font-bold">Ship faster</h1></section>;
}
\`\`\`
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return (
    <div className="min-h-screen">
      <Hero />
    </div>
  );
}
\`\`\`
`);
  assert(r.ok, "multi should pass");
  assert(r.isMulti, "isMulti");
}

// Dropped files warning
{
  const prev = JSON.stringify({
    v: 1,
    entry: "src/Component.tsx",
    files: {
      "src/Component.tsx": "function Component(){return <div><Navbar/><Hero/></div>}",
      "src/Navbar.tsx": "function Navbar(){return <nav>Nav</nav>}",
      "src/Hero.tsx": "function Hero(){return <h1>Hi</h1>}",
    },
    __ADGEN_PROJECT_V1__: true,
  });
  const r = validateGeneration(
    `Updated.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return <div className="p-8 text-lg">Only one file now with enough content to pass length checks.</div>;
}
\`\`\`
`,
    prev
  );
  assert(r.ok, "still ok with warning");
  assert(
    r.issues.some((i) => i.code === "dropped_files"),
    "dropped_files warning"
  );
}

// extra placeholders
{
  const r = validateGeneration(`Built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return <div className="p-8 min-h-screen">Your content here for the app shell</div>;
}
\`\`\`
`);
  assert(!r.ok, "your content here should fail");
}

// Truncated mid-string (token limit)
{
  const r = validateGeneration(`Building landing.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return (
    <div className="min-h-screen">
      <a href="#how" className="py-1
`);
  assert(!r.ok, "truncated should fail");
  assert(
    r.issues.some((i) => i.code === "truncated_code"),
    "truncated_code"
  );
}

// Regression: unclosed JSX opening tag (truncated mid-nesting) must be a
// hard `truncated_code` error, so a Continue that produces this shape cannot
// claim "Build complete". Previously brace/paren balance saw nothing wrong
// and the generation validated ok while Babel rejected it.
{
  const r = validateGeneration(`Built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-5xl font-bold">Harbor Goods</h1>
      <div className="grid grid-cols-3">
        <div className="p-4">
          <h2>Canvas Tote</h2>
          <p>$42</p>
      </div>
    </div>
  );
}
\`\`\`
`);
  assert(!r.ok, "unclosed JSX opener must fail validation");
  assert(
    r.issues.some((i) => i.code === "truncated_code"),
    "truncated_code for unclosed JSX opener"
  );
}

// ── ship gate (raw sources — production path) ─────────────────
{
  const good = `function Component() {
  const [formData, setFormData] = useState({ email: "", agree: false });
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  return (
    <form className="p-6">
      <input name="email" value={formData.email} onChange={handleChange} />
      <input name="agree" type="checkbox" checked={formData.agree} onChange={handleChange} />
    </form>
  );
}`;
  const shipOk = validateForShip(good);
  assert(shipOk.ok, "complete form should ship");
  assert(shipOk.fileCount >= 1, "file count");
}

{
  const cut = `function Component() {
  return (
    <div className="min-h-screen">
      <a href="#how" className="py-1
`;
  const shipBad = validateForShip(cut);
  assert(!shipBad.ok, "truncated must not ship");
  assert(
    shipBad.blockers.some((b) => /cut off|incomplete|Unbalanced/i.test(b)),
    "blocker mentions cut-off"
  );
}

{
  const empty = validateForShip("   ");
  assert(!empty.ok, "empty must not ship");
}

// ── ship readiness UI mapping ─────────────────────────────────
{
  const building = getShipReadyUi("function Component(){return <div/>}", true);
  assert(building.status === "building", "building while generating");
  assert(building.primaryAction === "generate", "no ship during build");

  const emptyUi = getShipReadyUi("", false);
  assert(emptyUi.status === "empty", "empty status");
  assert(emptyUi.primaryAction === "generate", "generate first");

  const goodUi = getShipReadyUi(
    `function Component() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Hello Shipboard</h1>
      <p className="text-muted-foreground">Ready for GitHub export.</p>
      <button type="button" className="mt-4 rounded-lg bg-orange-500 px-4 py-2">Go</button>
    </div>
  );
}`,
    false
  );
  assert(goodUi.status === "ready", "ready status");
  assert(goodUi.primaryAction === "push", "push when ready");

  const cutUi = getShipReadyUi(
    `function Component() {
  return (
    <div className="min-h-screen">
      <a href="#how" className="py-1
`,
    false
  );
  assert(cutUi.status === "blocked", "blocked when truncated");
  assert(cutUi.primaryAction === "continue", "continue when blocked");

  const crashUi = getShipReadyUi(
    `function Component() {
  return (
    <div className="min-h-screen p-8">
      <h1>Shop</h1>
      <button type="button">Buy</button>
    </div>
  );
}`,
    false,
    {
      qa: {
        ok: false,
        findings: [
          {
            severity: "error",
            category: "console",
            message: "PRODUCTS is not defined",
          },
        ],
      },
    }
  );
  assert(crashUi.status === "blocked", "blocked on live preview crash");
  assert(/PRODUCTS is not defined/.test(crashUi.detail), "surface runtime error");
  assert(crashUi.primaryAction === "generate", "compile/runtime fail is not Continue");
  assert(crashUi.label === "Preview blocked", "label is Preview blocked");

  const paintedUi = getShipReadyUi(
    `function Component() {
  return (
    <div className="min-h-screen p-8">
      <h1>Harbor Goods</h1>
      <button type="button">Buy</button>
    </div>
  );
}`,
    false,
    {
      qa: {
        ok: false,
        painted: true,
        findings: [
          {
            severity: "error",
            category: "console",
            message: "window.formatMoney is not a function",
          },
        ],
      },
    }
  );
  assert(paintedUi.status === "ready", "painted preview clears stale Preview blocked");
  assert(paintedUi.label === "Ready to ship", "label ready after paint");
}

{
  const withActions = getShipReadyUi(
    `import { listUsers } from "@/app/actions";
function Component() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    listUsers().then(setRows);
  }, []);
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-xl font-bold">Users</h1>
      <ul>{rows.map((u) => <li key={u.id}>{u.email}</li>)}</ul>
    </div>
  );
}
`,
    false,
    { byobSchema: null }
  );
  assert(withActions.status === "ready", "complete actions UI is ship-ready");
  assert(
    withActions.warnings.some((w) => /DATABASE_URL|@\/app\/actions|Drizzle/i.test(w)),
    "warn when actions without BYOB"
  );
}

// Bare top-level return gets auto-repaired (wrapped in function)
{
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return <div><ProductGrid /></div>;
}
\`\`\`
\`\`\`tsx file="src/ProductGrid.tsx"
return (
  <div className="grid">
    {PRODUCTS.map((p) => <div key={p.sku}>{p.name}</div>)}
  </div>
);
\`\`\`
`);
  assert(r.ok, "repaired generation should validate ok");
  assert(
    r.repairedFiles.includes("src/ProductGrid.tsx"),
    "repair reported"
  );
  assert(
    r.issues.some((i) => i.code === "auto_repaired"),
    "auto_repaired warning present"
  );
  assert(
    r.project.files["src/ProductGrid.tsx"]!.includes("function ProductGrid()"),
    "saved project contains the repair"
  );
}

// Unfixable structural problem is a named error with file + line
{
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  const x = { a: 1 };
  return <div>
\`\`\`
`);
  assert(!r.ok, "unbalanced file should fail validation");
  assert(
    r.issues.some(
      (i) => i.code === "syntax_error" && i.message.includes("src/Component.tsx")
    ),
    "syntax_error names the file"
  );
}

// Design-quality checks (visual-bar plan step 6)
{
  // Storefront without display-scale type -> warning
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  const PRODUCTS = [{ name: "Cap", priceCents: 3200 }];
  return (
    <div className="store-contrast">
      <h1 className="text-3xl font-bold">Harbor Goods</h1>
      <p>{formatMoney(PRODUCTS[0].priceCents)}</p>
    </div>
  );
}
\`\`\`
`);
  assert(r.ok, "design warnings must not hard-fail");
  assert(
    r.issues.some((i) => i.code === "design_no_display_scale"),
    "timid hero flagged"
  );
}

{
  // Low-contrast text + fixed width + unreserved image + hover-less button + 3 typefaces
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return (
    <div className="font-serif font-sans font-mono">
      <h1 className="text-7xl font-bold">Big Store</h1>
      <p className="text-zinc-400">muted copy</p>
      <div className="w-[500px]">wide</div>
      <img src="x.jpg" alt="x" />
      <button className="bg-black text-white">Buy</button>
    </div>
  );
}
\`\`\`
`);
  assert(r.ok, "design warnings must not hard-fail");
  const codes = r.issues.map((i) => i.code);
  for (const c of [
    "design_low_contrast",
    "design_fixed_width",
    "design_unreserved_images",
    "design_no_hover",
    "design_too_many_typefaces",
  ]) {
    assert(codes.includes(c), `${c} flagged`);
  }
}

{
  // Clean storefront: display scale, reserved images, hover states -> no design warnings
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  const PRODUCTS = [{ name: "Cap", priceCents: 3200 }];
  return (
    <div className="store-contrast font-sans">
      <h1 className="text-7xl font-bold">Harbor Goods</h1>
      <div className="aspect-[4/5] overflow-hidden">
        <img src="x.jpg" alt="x" className="object-cover" />
      </div>
      <button className="bg-black text-white hover:bg-zinc-800">Buy</button>
      <p>{formatMoney(PRODUCTS[0].priceCents)}</p>
    </div>
  );
}
\`\`\`
`);
  assert(
    !r.issues.some((i) => i.code.startsWith("design_")),
    "clean storefront has no design warnings"
  );
}

// Ground-aware contrast: muted text inside a dark band is readable — no flag
{
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  const PRODUCTS = [{ name: "Cap", priceCents: 3200 }];
  return (
    <section className="store-contrast w-full bg-zinc-950 text-zinc-50 py-20">
      <h1 className="text-7xl font-bold">Harbor Goods</h1>
      <p className="text-zinc-400">quiet meta copy on the dark band</p>
      <p>{formatMoney(PRODUCTS[0].priceCents)}</p>
    </section>
  );
}
\`\`\`
`);
  assert(
    !r.issues.some((i) => i.code === "design_low_contrast"),
    "muted text on dark band must not flag contrast"
  );
}

// Ground-aware contrast: arbitrary dark hex bg also counts as a dark ground
{
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  const PRODUCTS = [{ name: "Cap", priceCents: 3200 }];
  return (
    <section className="bg-[#1C1917] text-stone-100 py-20">
      <h1 className="text-7xl font-bold">Harbor Goods</h1>
      <p className="text-stone-400">quiet meta copy on atelier ink</p>
      <p>{formatMoney(PRODUCTS[0].priceCents)}</p>
    </section>
  );
}
\`\`\`
`);
  assert(
    !r.issues.some((i) => i.code === "design_low_contrast"),
    "muted text on dark hex bg must not flag contrast"
  );
}

// Ground-aware contrast: muted text on a light ground still flags
{
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  return (
    <div className="bg-white p-8">
      <h1 className="text-5xl font-bold">Light page</h1>
      <p className="text-zinc-400">faint copy on white</p>
      <button className="hover:bg-black">Go</button>
    </div>
  );
}
\`\`\`
`);
  assert(
    r.issues.some((i) => i.code === "design_low_contrast"),
    "muted text on light ground still flags"
  );
}

// Ground-aware contrast: self-closing tags with a space (<img />) must not
// pollute the ground stack — muted text after them inside a dark band stays silent
{
  const r = validateGeneration(`Store built.
\`\`\`tsx file="src/Component.tsx"
function Component() {
  const PRODUCTS = [{ name: "Cap", priceCents: 3200 }];
  return (
    <section className="store-contrast w-full bg-zinc-950 text-zinc-50 py-20">
      <h1 className="text-7xl font-bold">Harbor Goods</h1>
      <img src="x.jpg" alt="cap" />
      <p className="text-zinc-400">meta after a spaced self-closer</p>
      <p>{formatMoney(PRODUCTS[0].priceCents)}</p>
    </section>
  );
}
\`\`\`
`);
  assert(
    !r.issues.some((i) => i.code === "design_low_contrast"),
    "spaced self-closing tag must not corrupt ground tracking"
  );
}

console.log("gen-integrity tests: all passed");
