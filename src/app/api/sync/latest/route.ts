import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { listProjectFiles, parseProject } from "@/lib/project-files";
import {
  extractTokenFromRequest,
  resolvePat,
  sessionBelongsToTenant,
} from "@/lib/tenant-auth";

export const runtime = "nodejs";

/**
 * Multi-tenant sync pull — requires CLI PAT (sb_pat_…).
 * Session must belong to the PAT's tenant.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = extractTokenFromRequest(req, url);
  if (!raw) {
    return NextResponse.json(
      { error: "Bearer token required (sb_pat_… from Settings → Access)" },
      { status: 401 }
    );
  }

  const auth = await resolvePat(raw);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
  }

  const sessionId = url.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const allowed = await sessionBelongsToTenant(sessionId, auth.tenantId);
  if (!allowed) {
    // Soft path for local memory / unowned sessions during transition
    if (process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "Session not found for this tenant" },
        { status: 403 }
      );
    }
  }

  const versions = await storage.getVersions(sessionId);
  if (!versions?.length) {
    return NextResponse.json(
      { error: "No versions for session", files: [] },
      { status: 404 }
    );
  }

  const latest = versions[versions.length - 1];
  const project = parseProject(latest.code);
  const files = listProjectFiles(latest.code).map((f) => ({
    path: f.path.startsWith("src/")
      ? f.path.replace(/^src\//, "components/")
      : f.path.startsWith("components/")
        ? f.path
        : `components/${f.path.split("/").pop()}`,
    content: f.content,
  }));

  return NextResponse.json({
    sessionId,
    tenantId: auth.tenantId,
    versionId: latest.id,
    title: latest.title,
    updatedAt: latest.createdAt ?? new Date().toISOString(),
    entry: project.entry,
    files,
  });
}
