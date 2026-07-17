import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";
import {
  buildShipProjectFiles,
  githubHeaders,
  pushProjectFiles,
  slugifyRepoName,
  type ShipStack,
} from "@/lib/github-project";
import type { DatabaseSchemaMap } from "@/lib/byob/types";
import type { CustomAgentTool } from "@/lib/byob/agent-types";

export const maxDuration = 60;

/**
 * Create a new GitHub repo and push a full Next.js App Router project (default).
 * Pass stack: "vite" for the lightweight Vite scaffold.
 * Available to any connected user (OAuth or PAT) — not Pro-gated.
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
    repoName,
    description,
    isPrivate,
    code,
    commitMessage,
    title,
    stack = "next",
    byobSchema,
    customTools,
  } = body as {
    repoName?: string;
    description?: string;
    isPrivate?: boolean;
    code?: string;
    fileName?: string;
    commitMessage?: string;
    title?: string;
    stack?: ShipStack;
    byobSchema?: DatabaseSchemaMap | null;
    customTools?: CustomAgentTool[] | null;
  };

  if (!repoName || !code) {
    return NextResponse.json({ error: "repoName and code required" }, { status: 400 });
  }

  // Fail closed: never ship truncated / stub code to GitHub
  const { validateForShip } = await import("@/lib/gen-integrity");
  const shipGate = validateForShip(code);
  if (!shipGate.ok) {
    return NextResponse.json(
      {
        error: shipGate.blockers[0] || "Code is not ready to ship",
        shipGate: {
          ok: false,
          blockers: shipGate.blockers,
          fileCount: shipGate.fileCount,
        },
      },
      { status: 400 }
    );
  }

  const slug = slugifyRepoName(repoName);
  const headers = githubHeaders(token.accessToken);
  const projectTitle = title || description || repoName;
  const message =
    commitMessage || `feat: add ${projectTitle} via Shipboard`;

  try {
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: slug,
        description: description || `${projectTitle} — built with Shipboard`,
        private: isPrivate ?? false,
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

    if (!createRes.ok || !repoData.full_name) {
      const errMsg =
        repoData.errors?.[0]?.message ||
        repoData.message ||
        "Failed to create repository";
      return NextResponse.json(
        { error: errMsg },
        { status: createRes.status || 500 }
      );
    }

    // Wait for GitHub to finish auto_init (README on default branch)
    await new Promise((r) => setTimeout(r, 1800));

    const shipStack: ShipStack = stack === "vite" ? "vite" : "next";
    const files = buildShipProjectFiles({
      code,
      title: projectTitle,
      repoSlug: slug,
      stack: shipStack,
      byobSchema: byobSchema || null,
      customTools: customTools || null,
    });

    const push = await pushProjectFiles(
      headers,
      repoData.full_name,
      files,
      message
    );

    if (!push.ok) {
      // Repo exists but files failed — still return URL so user can recover
      return NextResponse.json(
        {
          error: push.error || "Repo created but failed to push files",
          url: repoData.html_url,
          name: repoData.name,
          fullName: repoData.full_name,
          filesWritten: push.filesWritten,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: repoData.html_url,
      name: repoData.name,
      fullName: repoData.full_name,
      filesWritten: push.filesWritten,
      stack: shipStack,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
