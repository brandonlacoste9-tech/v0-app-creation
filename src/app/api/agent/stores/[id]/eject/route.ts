import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { requireAgentAuth, assertSessionOwnership } from "@/lib/agent/auth";
import { getGitHubToken } from "@/lib/github-token";
import {
  buildShipProjectFiles,
  EjectCompileError,
  githubHeaders,
  pushProjectFiles,
  slugifyRepoName,
  type ShipStack,
} from "@/lib/github-project";
import { assertEjectSyntax } from "@/lib/eject-syntax";
import {
  containsPromptLeak,
  humanizeSlug,
  resolveMerchantName,
} from "@/lib/eject-gate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/agent/stores/[id]/eject — Eject the store to GitHub.
 * Auth: Authorization: Bearer sb_pat_...
 * Body: {
 *   repoName?: string (defaults to store title slug),
 *   description?: string, isPrivate?: boolean,
 *   githubToken?: string (GitHub PAT; falls back to connected OAuth),
 *   stack?: "next"|"vite"
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAgentAuth(req);
  if ("response" in authResult) return authResult.response;
  const { tenantId } = authResult.auth;

  const { id: sessionId } = await params;
  if (!(await assertSessionOwnership(sessionId, tenantId))) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const versions = await storage.getVersions(sessionId).catch(() => []);
  const latest = versions[versions.length - 1];
  if (!latest?.code?.trim()) {
    return NextResponse.json(
      { error: "No generated code to eject yet" },
      { status: 400 },
    );
  }
  const code = latest.code;

  // GitHub auth: explicit token in body, else connected OAuth cookie
  let accessToken: string | null =
    typeof body.githubToken === "string" && body.githubToken.trim()
      ? body.githubToken.trim()
      : null;
  if (!accessToken) {
    const gh = await getGitHubToken().catch(() => null);
    accessToken = gh?.accessToken || null;
  }
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "GitHub not connected",
        hint: "Pass githubToken (a GitHub personal access token with repo scope) or connect GitHub via OAuth in the studio.",
      },
      { status: 401 },
    );
  }

  // Ship gate — fail closed on broken code
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
      { status: 400 },
    );
  }

  const session = await storage.getSession(sessionId);
  const repoName =
    typeof body.repoName === "string" && body.repoName.trim()
      ? body.repoName.trim()
      : session?.title || "shipboard-store";
  const slug = slugifyRepoName(repoName);
  const headers = githubHeaders(accessToken);
  const projectTitle =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : session?.title || repoName;
  const publicTitle = resolveMerchantName({
    title: projectTitle,
    fallback: humanizeSlug(slug),
  });
  const shipStack: ShipStack = body.stack === "vite" ? "vite" : "next";

  let files;
  try {
    files = buildShipProjectFiles({
      code,
      title: projectTitle,
      repoSlug: slug,
      stack: shipStack,
      byobSchema: null,
      customTools: null,
    });
    assertEjectSyntax(files);
  } catch (err: unknown) {
    if (err instanceof EjectCompileError) {
      return NextResponse.json(
        {
          error: err.message,
          shipGate: { ok: false, blockers: err.blockers, fileCount: 0 },
        },
        { status: 400 },
      );
    }
    const msg =
      err instanceof Error ? err.message : "Failed to assemble project";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: slug,
        description: containsPromptLeak(projectTitle)
          ? `${publicTitle} — built with Shipboard`
          : projectTitle,
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

    if (!createRes.ok || !repoData.full_name) {
      const errMsg =
        repoData.errors?.[0]?.message ||
        repoData.message ||
        "Failed to create repository";
      return NextResponse.json(
        { error: errMsg },
        { status: createRes.status || 500 },
      );
    }

    await new Promise((r) => setTimeout(r, 1800));

    const push = await pushProjectFiles(
      headers,
      repoData.full_name,
      files,
      `feat: add ${publicTitle} via Shipboard`,
    );

    if (!push.ok) {
      return NextResponse.json(
        {
          error: push.error || "Repo created but failed to push files",
          url: repoData.html_url,
          name: repoData.name,
          fullName: repoData.full_name,
          filesWritten: push.filesWritten,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      url: repoData.html_url,
      name: repoData.name,
      fullName: repoData.full_name,
      filesWritten: push.filesWritten,
      stack: shipStack,
      storeId: sessionId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
