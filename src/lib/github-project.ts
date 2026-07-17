/** Shared Vite + React + Tailwind project scaffold for GitHub push / deploy. */

import { packageForVite } from "./project-files";

export type ProjectFile = { path: string; content: string };

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

/** Build a full runnable Vite project from generated component code (single or multi-file). */
export function buildViteProjectFiles(opts: {
  code: string;
  title: string;
  repoSlug?: string;
}): ProjectFile[] {
  const slug = opts.repoSlug || slugifyRepoName(opts.title);
  const title = opts.title || "Shipboard Project";

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
  <title>${title.replace(/</g, "")}</title>
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
      content: `# ${title}

Generated with [Shipboard](https://www.Shipboard.ca)

## Quick start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Stack

- React 18 + TypeScript
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
