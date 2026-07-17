import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { serializeProject } from "@/lib/project-files";

export const runtime = "nodejs";

/**
 * Phase D — Local Sync CLI push.
 * POST { sessionId, files: [{ path, content }], title? }
 * Writes a new studio version from local disk edits.
 */
function authorize(req: Request): boolean {
  const expected = process.env.SHIPBOARD_SYNC_TOKEN?.trim();
  if (!expected) return true;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return bearer === expected;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const fileMap: Record<string, string> = {};
  for (const f of body.files) {
    if (!f?.path || typeof f.content !== "string") continue;
    // Map components/* → src/* for studio multi-file format
    let p = f.path.replace(/\\/g, "/");
    if (p.startsWith("components/")) p = "src/" + p.slice("components/".length);
    if (!p.startsWith("src/")) p = `src/${p.split("/").pop()}`;
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
  });
}
