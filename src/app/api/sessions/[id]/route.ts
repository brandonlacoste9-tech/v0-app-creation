import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  const session = await storage.updateSession(id, data);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await storage.deleteSession(id);
  return NextResponse.json({ ok: true });
}
