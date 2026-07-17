/**
 * Lightweight integrity unit tests (node --import tsx or tsx runner).
 * Run: npx tsx src/lib/gen-integrity.test.ts
 */
import { validateGeneration } from "./gen-integrity";

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

console.log("gen-integrity tests: all passed");
