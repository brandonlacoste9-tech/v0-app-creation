import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await storage.getVersions(id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  const version = await storage.createVersion({ ...data, sessionId: id });
  return NextResponse.json(version);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { versionId, code } = await req.json();
  const version = await storage.updateVersion(id, versionId, { code });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(version);
}
