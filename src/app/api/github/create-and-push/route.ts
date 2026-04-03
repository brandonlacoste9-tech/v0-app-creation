import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";
import { getCurrentUser } from "@/lib/get-user";

export async function POST(req: Request) {
  const token = await getGitHubToken();
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  // Pro gate
  const user = await getCurrentUser();
  if (user && user.plan === "free") {
    return NextResponse.json(
      { error: "Push to GitHub is a Pro feature. Upgrade to unlock.", upgrade: true },
      { status: 403 }
    );
  }

  const { repoName, description, isPrivate, code, fileName } = await req.json();
  if (!repoName || !code) return NextResponse.json({ error: "repoName and code required" }, { status: 400 });

  const headers = {
    Authorization: `Bearer ${token.accessToken}`,
    "User-Agent": "adgenai",
    "Content-Type": "application/json",
  };

  try {
    // Create repo
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: repoName,
        description: description || "Created with adgenai",
        private: isPrivate ?? false,
        auto_init: true,
      }),
    });
    const repoData = (await createRes.json()) as { full_name: string; html_url: string; name: string; message?: string };
    if (!createRes.ok) {
      return NextResponse.json({ error: repoData.message || "Failed to create repo" }, { status: createRes.status });
    }

    await new Promise((r) => setTimeout(r, 1500));

    // Push component
    const filePath = fileName || "src/Component.tsx";
    const content = Buffer.from(code).toString("base64");
    await fetch(`https://api.github.com/repos/${repoData.full_name}/contents/${filePath}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message: "Add generated component from adgenai", content }),
    });

    // Push index.html
    const htmlContent = generateIndexHtml(code);
    const htmlBase64 = Buffer.from(htmlContent).toString("base64");
    await fetch(`https://api.github.com/repos/${repoData.full_name}/contents/index.html`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message: "Add index.html from adgenai", content: htmlBase64 }),
    });

    return NextResponse.json({ url: repoData.html_url, name: repoData.name, fullName: repoData.full_name });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function generateIndexHtml(code: string): string {
  const cleaned = code
    .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?\n?/g, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>adgenai Component</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>body { background: #0a0a0a; color: #f2f2f2; font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; }</style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer } = React;
    ${cleaned}
    const Root = typeof Component !== 'undefined' ? Component : (typeof App !== 'undefined' ? App : () => React.createElement('div', null, 'Component'));
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Root));
  <\/script>
</body>
</html>`;
}
