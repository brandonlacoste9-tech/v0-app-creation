import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";
import { assertSessionAccess } from "@/lib/session-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await assertSessionAccess(id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const data = await req.json();
  // Never allow client to reassign ownership fields
  const { title, starred, model } = data as {
    title?: string;
    starred?: boolean;
    model?: string;
  };
  const session = await storage.updateSession(id, {
    ...(title !== undefined ? { title: String(title).slice(0, 200) } : {}),
    ...(starred !== undefined ? { starred: Boolean(starred) } : {}),
    ...(model !== undefined ? { model: String(model).slice(0, 120) } : {}),
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await assertSessionAccess(id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await storage.deleteSession(id);

  // Keep free-tier cookie in sync when anonymous users delete projects
  const user = await getCurrentUser();
  if (!user) {
    const anon = await getAnonSession();
    const ids = (anon.sessionIds || []).filter((sid) => sid !== id);
    anon.sessionIds = ids;
    anon.projectCount = ids.length;
    await saveAnonSession(anon);
  }

  return NextResponse.json({ ok: true });
}
