import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";
import {
  buildViteProjectFiles,
  githubHeaders,
  pushProjectFiles,
  slugifyRepoName,
} from "@/lib/github-project";

export const maxDuration = 60;

interface DeployRequest {
  code: string;
  title: string;
  repoName?: string;
  isPrivate?: boolean;
}

/**
 * Ship flow: create GitHub repo with full Vite project + Vercel import URL.
 * Available to any connected GitHub user (OAuth or PAT).
 */
export async function POST(req: Request) {
  const token = await getGitHubToken();
  if (!token) {
    return NextResponse.json(
      { error: "Connect GitHub first (OAuth or Personal Access Token)." },
      { status: 401 }
    );
  }

  const body: DeployRequest = await req.json();
  const { code, title } = body;

  if (!code || !title) {
    return NextResponse.json({ error: "code and title required" }, { status: 400 });
  }

  const slug = slugifyRepoName(body.repoName || title, "Shipboard-deploy");
  const headers = githubHeaders(token.accessToken);

  try {
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: slug,
        description: `${title} — built with Shipboard`,
        private: body.isPrivate ?? false,
        auto_init: true,
      }),
    });

    const repoData = (await createRes.json()) as {
      full_name?: string;
      html_url?: string;
      name?: string;
      message?: string;
      errors?: Array<{ message: string }>;
    };

    if (!createRes.ok || !repoData.full_name || !repoData.html_url) {
      const errMsg =
        repoData.errors?.[0]?.message || repoData.message || "Failed to create repo";
      return NextResponse.json({ error: errMsg }, { status: createRes.status || 500 });
    }

    await new Promise((r) => setTimeout(r, 1800));

    const files = buildViteProjectFiles({
      code,
      title,
      repoSlug: slug,
    });

    const push = await pushProjectFiles(
      headers,
      repoData.full_name,
      files,
      `feat: deploy ${title} via Shipboard`
    );

    if (!push.ok) {
      return NextResponse.json(
        {
          error: push.error || "Repo created but file push failed",
          repoUrl: repoData.html_url,
          filesWritten: push.filesWritten,
        },
        { status: 502 }
      );
    }

    const vercelImportUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(repoData.html_url)}`;

    return NextResponse.json({
      repoUrl: repoData.html_url,
      repoFullName: repoData.full_name,
      vercelImportUrl,
      repoName: repoData.name,
      filesWritten: push.filesWritten,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Deploy failed";
    console.error("Deploy error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
