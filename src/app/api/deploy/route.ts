import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";

export const maxDuration = 30;

interface DeployRequest {
  code: string;
  title: string;
  repoName?: string;
}

// Helper to push a file to a GitHub repo via Contents API
async function pushFile(
  headers: Record<string, string>,
  repoFullName: string,
  filePath: string,
  content: string,
  message: string
) {
  const encoded = Buffer.from(content).toString("base64");
  await fetch(`https://api.github.com/repos/${repoFullName}/contents/${filePath}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content: encoded }),
  });
}

export async function POST(req: Request) {
  const token = await getGitHubToken();
  if (!token) {
    return NextResponse.json({ error: "Connect GitHub first to deploy." }, { status: 401 });
  }

  const body: DeployRequest = await req.json();
  const { code, title } = body;

  if (!code || !title) {
    return NextResponse.json({ error: "code and title required" }, { status: 400 });
  }

  const slug = (body.repoName || title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40) || "adgenai-deploy";

  const headers = {
    Authorization: `Bearer ${token.accessToken}`,
    "User-Agent": "adgenai",
    "Content-Type": "application/json",
  };

  try {
    // Step 1: Create GitHub repo
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: slug,
        description: `${title} — built with AdGenAI`,
        private: false,
        auto_init: true,
      }),
    });

    const repoData = (await createRes.json()) as {
      full_name: string;
      html_url: string;
      name: string;
      message?: string;
      errors?: Array<{ message: string }>;
    };

    if (!createRes.ok) {
      const errMsg = repoData.errors?.[0]?.message || repoData.message || "Failed to create repo";
      return NextResponse.json({ error: errMsg }, { status: createRes.status });
    }

    // Wait for repo to initialize
    await new Promise((r) => setTimeout(r, 2000));

    const repoFullName = repoData.full_name;

    // Step 2: Push full Vite project files
    const commitMsg = `feat: deploy ${title} via AdGenAI`;

    // Component
    await pushFile(headers, repoFullName, "src/Component.tsx", code, commitMsg);

    // Main entry
    await pushFile(headers, repoFullName, "src/main.tsx", [
      'import React from "react";',
      'import ReactDOM from "react-dom/client";',
      'import Component from "./Component";',
      'import "./index.css";',
      "",
      'ReactDOM.createRoot(document.getElementById("root")!).render(',
      "  <React.StrictMode>",
      "    <Component />",
      "  </React.StrictMode>",
      ");",
      "",
    ].join("\n"), commitMsg);

    // Tailwind CSS
    await pushFile(headers, repoFullName, "src/index.css", [
      "@tailwind base;",
      "@tailwind components;",
      "@tailwind utilities;",
      "",
    ].join("\n"), commitMsg);

    // index.html
    await pushFile(headers, repoFullName, "index.html", [
      "<!DOCTYPE html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="UTF-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `  <title>${title}</title>`,
      "</head>",
      "<body>",
      '  <div id="root"></div>',
      '  <script type="module" src="/src/main.tsx"></script>',
      "</body>",
      "</html>",
      "",
    ].join("\n"), commitMsg);

    // package.json
    await pushFile(headers, repoFullName, "package.json", JSON.stringify({
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
    }, null, 2) + "\n", commitMsg);

    // tsconfig.json
    await pushFile(headers, repoFullName, "tsconfig.json", JSON.stringify({
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
    }, null, 2) + "\n", commitMsg);

    // vite.config.ts
    await pushFile(headers, repoFullName, "vite.config.ts", [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      "",
      "export default defineConfig({",
      "  plugins: [react()],",
      "});",
      "",
    ].join("\n"), commitMsg);

    // tailwind.config.js
    await pushFile(headers, repoFullName, "tailwind.config.js", [
      "/** @type {import('tailwindcss').Config} */",
      "export default {",
      '  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],',
      "  theme: { extend: {} },",
      "  plugins: [],",
      "};",
      "",
    ].join("\n"), commitMsg);

    // postcss.config.js
    await pushFile(headers, repoFullName, "postcss.config.js", [
      "export default {",
      "  plugins: {",
      "    tailwindcss: {},",
      "    autoprefixer: {},",
      "  },",
      "};",
      "",
    ].join("\n"), commitMsg);

    // Build Vercel import URL
    const vercelImportUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(repoData.html_url)}`;

    return NextResponse.json({
      repoUrl: repoData.html_url,
      repoFullName,
      vercelImportUrl,
      repoName: repoData.name,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Deploy failed";
    console.error("Deploy error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
