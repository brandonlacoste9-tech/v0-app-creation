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

console.log("gen-integrity tests: all passed");
