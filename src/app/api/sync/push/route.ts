import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { serializeProject } from "@/lib/project-files";
import {
  extractTokenFromRequest,
  resolvePat,
  sessionBelongsToTenant,
} from "@/lib/tenant-auth";
import { checkAndConsume } from "@/lib/economic-limits";

export const runtime = "nodejs";

/**
 * Multi-tenant sync push — requires CLI PAT; session must belong to tenant.
 */
export async function POST(req: Request) {
  const raw = extractTokenFromRequest(req);
  if (!raw) {
    return NextResponse.json(
      { error: "Bearer token required (sb_pat_…)" },
      { status: 401 }
    );
  }

  const auth = await resolvePat(raw);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
  }

  let body: {
    sessionId?: string;
    title?: string;
    files?: { path: string; content: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId || !body.files?.length) {
    return NextResponse.json(
      { error: "sessionId and files required" },
      { status: 400 }
    );
  }

  const allowed = await sessionBelongsToTenant(sessionId, auth.tenantId);
  if (!allowed && process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Session not found for this tenant" },
      { status: 403 }
    );
  }

  const user = await storage.getUserById(auth.tenantId);
  const econ = await checkAndConsume(
    auth.tenantId,
    user?.plan ?? "free",
    "sync_ops",
    1
  );
  if (!econ.allowed) {
    return NextResponse.json(
      { error: econ.error, code: econ.code, usage: econ.usage },
      {
        status: 429,
        headers: econ.retryAfterSec
          ? { "Retry-After": String(econ.retryAfterSec) }
          : undefined,
      }
    );
  }

  const fileMap: Record<string, string> = {};
  for (const f of body.files) {
    if (!f?.path || typeof f.content !== "string") continue;
    let p = f.path.replace(/\\/g, "/");
    if (p.startsWith("components/")) p = "src/" + p.slice("components/".length);
    if (!p.startsWith("src/")) p = `src/${p.split("/").pop()}`;
    // Cap file size (2MB)
    if (f.content.length > 2_000_000) continue;
    fileMap[p] = f.content;
  }

  if (!Object.keys(fileMap).length) {
    return NextResponse.json({ error: "No valid files" }, { status: 400 });
  }

  const entry =
    fileMap["src/Component.tsx"] != null
      ? "src/Component.tsx"
      : Object.keys(fileMap)[0];

  const code = serializeProject(fileMap, entry);
  const version = await storage.createVersion({
    id: crypto.randomUUID(),
    sessionId,
    code,
    title: body.title || `Local sync ${new Date().toISOString().slice(0, 16)}`,
    prompt: "shipboard CLI push",
  });

  return NextResponse.json({
    ok: true,
    versionId: version.id,
    title: version.title,
    fileCount: Object.keys(fileMap).length,
    tenantId: auth.tenantId,
  });
}
