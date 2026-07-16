import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";
import {
  buildViteProjectFiles,
  githubHeaders,
  putRepoFile,
  pushProjectFiles,
} from "@/lib/github-project";

export const maxDuration = 60;

/**
 * Push generated code into an existing repo.
 * - fullProject: true (default) → full Vite scaffold
 * - fullProject: false → single file (fileName)
 */
export async function POST(req: Request) {
  const token = await getGitHubToken();
  if (!token) {
    return NextResponse.json(
      { error: "Not connected to GitHub. Connect with OAuth or a Personal Access Token." },
      { status: 401 }
    );
  }

  const body = await req.json();
  const {
    repoFullName,
    code,
    fileName,
    commitMessage,
    branch,
    fullProject = true,
    title,
  } = body as {
    repoFullName?: string;
    code?: string;
    fileName?: string;
    commitMessage?: string;
    branch?: string;
    fullProject?: boolean;
    title?: string;
  };

  if (!repoFullName || !code) {
    return NextResponse.json(
      { error: "repoFullName and code required" },
      { status: 400 }
    );
  }

  const headers = githubHeaders(token.accessToken);
  const message = commitMessage || "Update component from AdGenAI";
  const projectTitle = title || repoFullName.split("/").pop() || "AdGenAI Project";

  try {
    if (!fullProject) {
      const path = fileName || "src/Component.tsx";
      const res = await putRepoFile(
        headers,
        repoFullName,
        path,
        code,
        message,
        branch || undefined
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: res.error || "Failed to push" },
          { status: res.status }
        );
      }
      return NextResponse.json({
        url: res.url || `https://github.com/${repoFullName}`,
        filesWritten: 1,
      });
    }

    const slug = repoFullName.split("/").pop() || "adgenai-project";
    const files = buildViteProjectFiles({
      code,
      title: projectTitle,
      repoSlug: slug,
    });

    const push = await pushProjectFiles(
      headers,
      repoFullName,
      files,
      message,
      branch || undefined
    );

    if (!push.ok) {
      return NextResponse.json(
        {
          error: push.error || "Failed to push project files",
          filesWritten: push.filesWritten,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: `https://github.com/${repoFullName}`,
      filesWritten: push.filesWritten,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
