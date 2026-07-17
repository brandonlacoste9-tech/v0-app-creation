/**
 * Shipboard escape hatch — full project scaffolds for GitHub push / deploy.
 *
 * Bifurcation (preview vs ship):
 * - Studio stores multi-file UI sources (canonical).
 * - Live preview: merge + strip types/imports (iframe Babel) — zero extra LLM.
 * - Ship/export: deterministic packaging into Next.js (default) or Vite.
 * Dual-pass LLM refactor is NOT used for MVP (parity drift risk).
 */

import { packageForNext, packageForVite } from "./project-files";
import type { DatabaseSchemaMap } from "./byob/types";
import type { CustomAgentTool } from "./byob/agent-types";
import {
  buildByobShipFiles,
  byobDevDependencies,
  byobPackageDependencies,
} from "./byob/drizzle-codegen";
import {
  agentPackageDependencies,
  buildAgentShipFiles,
  generateAgentEnvExample,
} from "./byob/agent-codegen";
import { isValidToolName } from "./byob/agent-types";

export type ProjectFile = { path: string; content: string };

/** Export stack for escape hatch */
export type ShipStack = "next" | "vite";

export function slugifyRepoName(title: string, fallback = "Shipboard-project"): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40) || fallback
  );
}

function escTitle(title: string): string {
  return title.replace(/</g, "").replace(/&/g, "&amp;");
}

/**
 * Build a production-oriented Next.js App Router project (default escape hatch).
 * Developer path: clone → npm install → npm run dev (WSL/local) — standard stack, no proprietary runtime.
 */
export function buildNextProjectFiles(opts: {
  code: string;
  title: string;
  repoSlug?: string;
  /** BYOB schema — emits lib/db + app/actions + .env.example */
  byobSchema?: DatabaseSchemaMap | null;
  /** Phase C custom agent tools */
  customTools?: CustomAgentTool[] | null;
}): ProjectFile[] {
  const slug = opts.repoSlug || slugifyRepoName(opts.title);
  const title = opts.title || "Shipboard Project";
  const safeTitle = escTitle(title);
  const byob = opts.byobSchema?.tables?.length ? opts.byobSchema : null;
  const customTools = (opts.customTools || []).filter(
    (t) => t.enabled && isValidToolName(t.name)
  );
  const hasAgent = Boolean(byob) || customTools.length > 0;

  const modules = packageForNext(opts.code);
  const sourceFiles: ProjectFile[] = Object.entries(modules).map(([path, content]) => ({
    path,
    content: content.endsWith("\n") ? content : content + "\n",
  }));

  if (!sourceFiles.some((f) => f.path === "components/Component.tsx")) {
    sourceFiles.push({
      path: "components/Component.tsx",
      content: `export default function Component() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-zinc-500">No UI was exported. Re-generate in Shipboard.</p>
    </main>
  );
}
`,
    });
  }

  const byobFiles: ProjectFile[] = byob
    ? buildByobShipFiles(byob, { customTools }).map((f) => ({
        path: f.path,
        content: f.content.endsWith("\n") ? f.content : f.content + "\n",
      }))
    : hasAgent
      ? buildAgentShipFiles({ schema: null, customTools }).map((f) => ({
          path: f.path,
          content: f.content.endsWith("\n") ? f.content : f.content + "\n",
        }))
      : [];

  // Agent-only env when no BYOB
  if (!byob && hasAgent) {
    byobFiles.push({
      path: ".env.example",
      content: generateAgentEnvExample() + "\n",
    });
  }

  const deps: Record<string, string> = {
    next: "^15.1.0",
    react: "^19.0.0",
    "react-dom": "^19.0.0",
    ...(byob ? byobPackageDependencies() : {}),
    ...(!byob && hasAgent ? agentPackageDependencies() : {}),
  };
  const devDeps: Record<string, string> = {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    autoprefixer: "^10.4.20",
    postcss: "^8.4.49",
    tailwindcss: "^3.4.16",
    typescript: "^5.7.0",
    ...(byob ? byobDevDependencies() : {}),
  };

  return [
    ...sourceFiles,
    ...byobFiles,
    {
      path: "app/layout.tsx",
      content: `import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(safeTitle)},
  description: "Built with Shipboard — Next.js + React + Tailwind",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
`,
    },
    {
      path: "app/page.tsx",
      content: `import Component from "@/components/Component";

/**
 * App entry — generated UI lives under /components.
 * Extend with routes, server actions, and your own data layer freely.
 */
export default function Page() {
  return <Component />;
}
`,
    },
    {
      path: "app/globals.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light dark;
}

body {
  margin: 0;
}
`,
    },
    {
      path: "package.json",
      content:
        JSON.stringify(
          {
            name: slug,
            private: true,
            version: "0.1.0",
            scripts: {
              dev: "next dev",
              build: "next build",
              start: "next start",
              lint: "next lint",
              ...(byob
                ? {
                    "db:studio": "drizzle-kit studio",
                    "db:generate": "drizzle-kit generate",
                  }
                : {}),
            },
            dependencies: deps,
            devDependencies: devDeps,
          },
          null,
          2
        ) + "\n",
    },
    {
      path: "tsconfig.json",
      content:
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2017",
              lib: ["dom", "dom.iterable", "esnext"],
              allowJs: false,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: "esnext",
              moduleResolution: "bundler",
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: "preserve",
              incremental: true,
              plugins: [{ name: "next" }],
              paths: { "@/*": ["./*"] },
            },
            include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
            exclude: ["node_modules"],
          },
          null,
          2
        ) + "\n",
    },
    {
      path: "next.config.ts",
      content: `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`,
    },
    {
      path: "next-env.d.ts",
      content: `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited — see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`,
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,
    },
    {
      path: "postcss.config.mjs",
      content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`,
    },
    {
      path: "README.md",
      content: `# ${safeTitle}

Generated with [Shipboard](https://shipboard.ca) — **your code, your repo**.

This is a standard **Next.js App Router** project (React + TypeScript + Tailwind). No proprietary runtime. Clone it, open in WSL/VS Code, and keep building.

## Quick start (local / WSL)

\`\`\`bash
git clone <your-repo-url>
cd ${slug}
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000).

## Project layout

| Path | Role |
|------|------|
| \`app/page.tsx\` | Route entry — renders your UI |
| \`app/layout.tsx\` | Root layout + metadata |
| \`components/\` | Generated UI (Component + sections) |
| \`app/globals.css\` | Tailwind entry |

## What you own

- Full source under git — eject anytime
- Strict TypeScript (\`tsconfig\` \`strict: true\`)
- Idiomatic Next.js 15 App Router
- Tailwind you can extend freely

## Next steps for production

1. Add env vars in \`.env.local\` as you wire APIs
2. Split routes under \`app/\` as the product grows
3. Attach your own DB (Neon/Supabase) — Shipboard does not lock you in
4. \`npm run build && npm start\` to verify production build

## Stack

- Next.js 15 (App Router)
- React 19 + TypeScript (strict)
- Tailwind CSS 3${
        byob
          ? `
- Drizzle ORM + Neon serverless (BYOB)
- Server Actions in \`app/actions.ts\`

## Database (BYOB)

1. Copy \`.env.example\` → \`.env.local\`
2. Set \`DATABASE_URL\` to your Neon/Supabase connection string
3. \`npm run dev\` — Server Actions use Drizzle against your DB

Schema was introspected from **${byob.provider}** (${byob.tableCount} public table(s)).
`
          : ""
      }
`,
    },
    {
      path: ".gitignore",
      content: `# dependencies
node_modules
.pnp
.pnp.js

# next
.next
out

# env
.env
.env*.local

# debug / os
npm-debug.log*
.DS_Store
*.pem

# vercel
.vercel
`,
    },
    // Default .env.example when no BYOB (BYOB file overwrites via byobFiles)
    ...(!byob
      ? [
          {
            path: ".env.example",
            content: `# Optional — add as you wire APIs
# DATABASE_URL=postgresql://user:password@host/db?sslmode=require
`,
          } satisfies ProjectFile,
        ]
      : []),
  ];
}

/** Build a full runnable Vite project (legacy / lightweight escape hatch). */
export function buildViteProjectFiles(opts: {
  code: string;
  title: string;
  repoSlug?: string;
}): ProjectFile[] {
  const slug = opts.repoSlug || slugifyRepoName(opts.title);
  const title = opts.title || "Shipboard Project";
  const safeTitle = escTitle(title);

  // Real ES modules with imports/exports (not a single merged blob)
  const modules = packageForVite(opts.code);
  const sourceFiles: ProjectFile[] = Object.entries(modules).map(([path, content]) => ({
    path: path.startsWith("src/") || !path.includes("/") ? (path.startsWith("src/") ? path : `src/${path}`) : path,
    content: content.endsWith("\n") ? content : content + "\n",
  }));

  // Guarantee Component.tsx exists for main.tsx
  if (!sourceFiles.some((f) => f.path === "src/Component.tsx")) {
    const first = sourceFiles.find((f) => /\.tsx?$/.test(f.path));
    if (first) {
      sourceFiles.push({
        path: "src/Component.tsx",
        content: `export { default } from "./${first.path.replace(/^src\//, "").replace(/\.tsx?$/, "")}";\n`,
      });
    }
  }

  return [
    ...sourceFiles,
    {
      path: "src/main.tsx",
      content: `import React from "react";
import ReactDOM from "react-dom/client";
import Component from "./Component";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
);
`,
    },
    {
      path: "src/index.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`,
    },
    {
      path: "package.json",
      content:
        JSON.stringify(
          {
            name: slug,
            private: true,
            version: "0.1.0",
            type: "module",
            scripts: {
              dev: "vite",
              build: "tsc && vite build",
              preview: "vite preview",
            },
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
            },
            devDependencies: {
              "@types/react": "^18.2.0",
              "@types/react-dom": "^18.2.0",
              "@vitejs/plugin-react": "^4.2.0",
              autoprefixer: "^10.4.16",
              postcss: "^8.4.32",
              tailwindcss: "^3.4.0",
              typescript: "^5.3.0",
              vite: "^5.0.0",
            },
          },
          null,
          2
        ) + "\n",
    },
    {
      path: "tsconfig.json",
      content:
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2020",
              useDefineForClassFields: true,
              lib: ["ES2020", "DOM", "DOM.Iterable"],
              module: "ESNext",
              skipLibCheck: true,
              moduleResolution: "bundler",
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: "react-jsx",
              strict: true,
              noUnusedLocals: false,
              noUnusedParameters: false,
              noFallthroughCasesInSwitch: true,
            },
            include: ["src"],
          },
          null,
          2
        ) + "\n",
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
    },
    {
      path: "tailwind.config.js",
      content: `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
    },
    {
      path: "postcss.config.js",
      content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    },
    {
      path: "README.md",
      content: `# ${safeTitle}

Generated with [Shipboard](https://shipboard.ca)

## Quick start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Stack

- React 18 + TypeScript (strict)
- Tailwind CSS
- Vite
`,
    },
    {
      path: ".gitignore",
      content: `node_modules
dist
.DS_Store
*.local
.env
.env.*
`,
    },
  ];
}

/** Default ship export — Next.js App Router (true escape hatch). */
export function buildShipProjectFiles(opts: {
  code: string;
  title: string;
  repoSlug?: string;
  stack?: ShipStack;
  byobSchema?: DatabaseSchemaMap | null;
  customTools?: CustomAgentTool[] | null;
}): ProjectFile[] {
  if (opts.stack === "vite") {
    return buildViteProjectFiles(opts);
  }
  return buildNextProjectFiles(opts);
}

export function githubHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "Shipboard",
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Create or update a file via Contents API. */
export async function putRepoFile(
  headers: Record<string, string>,
  repoFullName: string,
  filePath: string,
  content: string,
  message: string,
  branch?: string
): Promise<{ ok: boolean; status: number; error?: string; url?: string }> {
  const encoded = Buffer.from(content).toString("base64");
  let sha: string | undefined;

  const qs = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const existRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/contents/${filePath}${qs}`,
    { headers }
  );
  if (existRes.ok) {
    const existData = (await existRes.json()) as { sha?: string };
    sha = existData.sha;
  }

  const body: Record<string, string> = {
    message,
    content: encoded,
  };
  if (sha) body.sha = sha;
  if (branch) body.branch = branch;

  const pushRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/contents/${filePath}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    }
  );

  if (!pushRes.ok) {
    const err = (await pushRes.json().catch(() => ({}))) as { message?: string };
    return {
      ok: false,
      status: pushRes.status,
      error: err.message || `Failed to write ${filePath}`,
    };
  }

  const result = (await pushRes.json()) as {
    content?: { html_url?: string };
  };
  return {
    ok: true,
    status: pushRes.status,
    url: result.content?.html_url,
  };
}

/** Push all project files sequentially (Contents API rate-friendly). */
export async function pushProjectFiles(
  headers: Record<string, string>,
  repoFullName: string,
  files: ProjectFile[],
  commitMessage: string,
  branch?: string
): Promise<{ ok: boolean; error?: string; filesWritten: number }> {
  let written = 0;
  for (const file of files) {
    const res = await putRepoFile(
      headers,
      repoFullName,
      file.path,
      file.content,
      commitMessage,
      branch
    );
    if (!res.ok) {
      return {
        ok: false,
        error: res.error || `Failed on ${file.path}`,
        filesWritten: written,
      };
    }
    written++;
  }
  return { ok: true, filesWritten: written };
}
