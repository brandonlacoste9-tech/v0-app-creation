import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";

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

  // Keep free-tier cookie in sync when anonymous users delete projects
  const user = await getCurrentUser();
  if (!user) {
    const anon = await getAnonSession();
    const liveCount = (await storage.getSessions()).length;
    anon.projectCount = liveCount;
    await saveAnonSession(anon);
  }

  return NextResponse.json({ ok: true });
}
