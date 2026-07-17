/**
 * Run: npx tsx src/lib/github-project.test.ts
 */
import {
  buildNextProjectFiles,
  buildShipProjectFiles,
  buildViteProjectFiles,
} from "./github-project";
import { packageForNext, serializeProject } from "./project-files";

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
  const pkg = JSON.parse(files.find((f) => f.path === "package.json")!.content);
  assert(pkg.dependencies.next, "depends on next");
  assert(pkg.scripts.dev === "next dev", "dev script");
  const tsconfig = JSON.parse(files.find((f) => f.path === "tsconfig.json")!.content);
  assert(tsconfig.compilerOptions.strict === true, "strict TS");
  const readme = files.find((f) => f.path === "README.md")!.content;
  assert(readme.includes("npm install"), "readme install");
  assert(readme.includes("WSL") || readme.includes("local"), "readme local path");
}

{
  const next = buildShipProjectFiles({ code: multi, title: "X", stack: "next" });
  const vite = buildShipProjectFiles({ code: multi, title: "X", stack: "vite" });
  assert(next.some((f) => f.path === "app/page.tsx"), "ship default next");
  assert(vite.some((f) => f.path === "src/main.tsx"), "ship vite option");
  assert(buildViteProjectFiles({ code: multi, title: "X" }).length > 5, "vite still works");
}

console.log("github-project tests: all passed");
