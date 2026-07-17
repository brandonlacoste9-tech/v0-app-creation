import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { listProjectFiles, parseProject } from "@/lib/project-files";

export const runtime = "nodejs";

/**
 * Phase D — Local Sync CLI pull.
 * GET ?sessionId=... → latest version as file list for disk write.
 *
 * Auth: optional SYNC_TOKEN via Authorization Bearer or ?token=
 */
function authorize(req: Request, url: URL): boolean {
  const expected = process.env.SHIPBOARD_SYNC_TOKEN?.trim();
  if (!expected) return true;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = url.searchParams.get("token") || "";
  return bearer === expected || q === expected;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authorize(req, url)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = url.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
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

  // Ensure Component entry path is consistent for Next ship layout
  const normalized = files.map((f) => {
    if (f.path === "components/Component.tsx" || f.path.endsWith("/Component.tsx")) {
      return f;
    }
    return f;
  });

  return NextResponse.json({
    sessionId,
    versionId: latest.id,
    title: latest.title,
    updatedAt: latest.createdAt ?? new Date().toISOString(),
    entry: project.entry,
    files: normalized,
  });
}
