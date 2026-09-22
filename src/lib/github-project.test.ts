/**
 * Run: npx tsx src/lib/github-project.test.ts
 */
import {
  buildNextProjectFiles,
  buildShipProjectFiles,
  buildViteProjectFiles,
} from "./github-project";
import { packageForNext, serializeProject } from "./project-files";
import { assertEjectSyntax } from "./eject-syntax";
import { EjectCompileError } from "./eject-gate";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

const multi = serializeProject(
  {
    "src/Hero.tsx": `function Hero() {
  return <h1 className="text-4xl font-bold">Hello</h1>;
}
`,
    "src/Component.tsx": `function Component() {
  return (
    <div className="min-h-screen p-8">
      <Hero />
    </div>
  );
}
`,
  },
  "src/Component.tsx"
);

{
  const mods = packageForNext(multi);
  assert(Boolean(mods["components/Component.tsx"]), "next maps Component");
  assert(Boolean(mods["components/Hero.tsx"]), "next maps Hero");
  assert(
    mods["components/Component.tsx"].includes("import Hero"),
    "entry imports Hero"
  );
}

{
  const files = buildNextProjectFiles({
    code: multi,
    title: "Acme Landing",
    repoSlug: "acme-landing",
  });
  const paths = new Set(files.map((f) => f.path));
  assert(paths.has("app/page.tsx"), "has app/page");
  assert(paths.has("app/layout.tsx"), "has app/layout");
  assert(paths.has("components/Component.tsx"), "has components/Component");
  assert(paths.has("package.json"), "has package.json");
  assert(paths.has("tsconfig.json"), "has tsconfig");
  assert(paths.has("BETA.md"), "ships BETA.md with eject");
  assert(paths.has("netlify.toml"), "ships netlify.toml for Next.js plugin");
  const pkg = JSON.parse(files.find((f) => f.path === "package.json")!.content);
  assert(pkg.dependencies.next, "depends on next");
  assert(pkg.devDependencies["@netlify/plugin-nextjs"], "netlify next plugin");
  assert(pkg.scripts.dev === "next dev", "dev script");
  const tsconfig = JSON.parse(files.find((f) => f.path === "tsconfig.json")!.content);
  assert(tsconfig.compilerOptions.strict === true, "strict TS");
  const readme = files.find((f) => f.path === "README.md")!.content;
  assert(readme.includes("Shipboard Generated App"), "generated app title");
  assert(readme.includes("BETA.md"), "readme points to BETA.md");
  assert(readme.includes("npm install"), "readme install");
}

{
  const next = buildShipProjectFiles({ code: multi, title: "X", stack: "next" });
  const vite = buildShipProjectFiles({ code: multi, title: "X", stack: "vite" });
  assert(next.some((f) => f.path === "app/page.tsx"), "ship default next");
  assert(vite.some((f) => f.path === "src/main.tsx"), "ship vite option");
  assert(buildViteProjectFiles({ code: multi, title: "X" }).length > 5, "vite still works");
}

{
  const routed = serializeProject(
    {
      "src/Component.tsx": `const PRODUCTS = [
  { sku: "EMBER-ROAST-", title: "Ember Roast Beans", price: 1800, brand: "Copperline Coffee" }
];
function Component() {
  const [n, setN] = useState(null);
  return <main onClick={() => setN(n)}>{PRODUCTS[0].title}</main>;
}
`,
      "src/Header.tsx": `export default async function Header() {
  return <header>Copperline</header>;
}
`,
      "app/api/acp/checkout-sessions/route.ts": `export async function OPTIONS() {
  return null;
}
export async function GET(req: Request) {
  return null;
}
export async function POST(req: Request) {
  return null;
}
`,
      "app/admin/orders/page.tsx": `async export default function AdminOrdersPage() {
  return <main>orders</main>;
}
`,
    },
    "src/Component.tsx"
  );
  const mods = packageForNext(routed);
  const header = mods["components/Header.tsx"];
  assert(header.includes("export default async function Header"), "async stays after export");
  assert(!header.includes("async export"), "header has no async export");
  const route = mods["app/api/acp/checkout-sessions/route.ts"];
  assert(route.includes("export async function OPTIONS(req: Request)"), "OPTIONS is a named export");
  assert(route.includes("export async function GET"), "GET stays exported");
  assert(route.includes("export async function POST"), "POST stays exported");
  assert(!route.includes("export default"), "route has no default export");
  assert(!route.includes("async export"), "route has no async export");
  const admin = mods["app/admin/orders/page.tsx"];
  assert(admin.includes("export default async function AdminOrdersPage"), "page default is async");
  assert(!admin.includes("async export"), "page has no async export");
  const entry = mods["components/Component.tsx"];
  assert(entry.includes('import Header from "./Header"'), "entry imports the sibling");
  assert(!entry.includes("checkout-sessions"), "entry does not import route modules");
  assert(!entry.includes("async export"), "entry has no async export");
  assert(entry.includes("useState"), "useState import or call kept");
  assert(entry.includes('"use client"'), "hook component is a client component");
  assert(entry.trimStart().startsWith('"use client"'), "directive is the first line");
  const again = packageForNext(
    serializeProject(
      {
        "src/Component.tsx": entry,
        "src/Header.tsx": header,
      },
      "src/Component.tsx"
    )
  );
  const reentry = again["components/Component.tsx"];
  assert(reentry.trimStart().startsWith('"use client"'), "re-eject keeps the directive first");
  assert(
    reentry.indexOf('"use client"') === reentry.lastIndexOf('"use client"'),
    "re-eject does not duplicate the directive"
  );

  const poisoned =
    "Fix these UI quality issues. Keep the same product concept.\nRequirements: real useState where needed, no lorem, no TypeScript types, no imports, entry Component().\nDo not claim the preview compiles. The platform Babel-checks the result after you return.";
  const ship = buildNextProjectFiles({
    code: routed,
    title: poisoned,
    repoSlug: "copperline-coffee",
    commerce: true,
  });
  assertEjectSyntax(ship);
  for (const file of ship) {
    assert(!file.content.includes("Do not claim the preview compiles"), "leak in " + file.path);
    assert(!file.content.includes("async export"), "async export in " + file.path);
  }
  const catalog = ship.find((f) => f.path === "lib/catalog.ts")!.content;
  assert(catalog.includes("Copperline Coffee"), "merchant falls back to product brand");
  assert(catalog.includes("EMBER-ROAST-"), "merchant sku kept");
  assert(!catalog.includes("NL-NB-01"), "northline sku not injected");
  const acp = ship.find((f) => f.path === "app/api/acp/checkout-sessions/route.ts")!.content;
  assert(
    acp.includes("export async function OPTIONS(req: Request)"),
    "shipped OPTIONS matches GET/POST"
  );
  assert(!acp.includes("export default"), "shipped route has no default");
  const page = ship.find((f) => f.path === "app/admin/orders/page.tsx")!.content;
  assert(page.includes("export default async function AdminOrdersPage"), "admin page export order");
  const success = ship.find((f) => f.path === "app/checkout/success/page.tsx")!.content;
  assert(success.includes("Copperline Coffee"), "success page uses the store name");
  assert(!success.includes("Requirements: real useState"), "success page has no prompt");
}

{
  let threw = false;
  try {
    buildNextProjectFiles({
      code: serializeProject(
        {
          "src/Component.tsx": `function Component() {
  return <p>Do not claim the preview compiles. The platform Babel-checks the result after you return.</p>;
}
`,
        },
        "src/Component.tsx"
      ),
      title: "Plain",
    });
  } catch (err) {
    threw = err instanceof EjectCompileError;
  }
  assert(threw, "prompt text in a component blocks eject");
}

console.log("github-project tests: all passed");
