import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { assertSessionAccess } from "@/lib/session-access";

const MAX_CODE_BYTES = 500_000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await assertSessionAccess(id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  return NextResponse.json(await storage.getVersions(id));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await assertSessionAccess(id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const data = await req.json();
  const code = typeof data.code === "string" ? data.code : "";
  if (code.length > MAX_CODE_BYTES) {
    return NextResponse.json({ error: "Code too large" }, { status: 400 });
  }

  const version = await storage.createVersion({
    id: typeof data.id === "string" && data.id ? data.id : crypto.randomUUID(),
    sessionId: id,
    code,
    title: String(data.title || "").slice(0, 200),
    language: String(data.language || "tsx").slice(0, 32),
    ...(typeof data.prompt === "string" ? { prompt: data.prompt.slice(0, 500) } : {}),
  });
  return NextResponse.json(version);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await assertSessionAccess(id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json();
  const { versionId, code } = body as { versionId?: string; code?: string; title?: string };
  if (typeof versionId !== "string" || !versionId || typeof code !== "string") {
    return NextResponse.json({ error: "versionId and code required" }, { status: 400 });
  }
  if (code.length > MAX_CODE_BYTES) {
    return NextResponse.json({ error: "Code too large" }, { status: 400 });
  }
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.slice(0, 200)
      : undefined;
  const version = await storage.updateVersion(id, versionId, {
    code,
    ...(title ? { title } : {}),
  });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(version);
}
