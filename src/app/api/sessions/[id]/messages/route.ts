import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { assertSessionAccess } from "@/lib/session-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await assertSessionAccess(id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  return NextResponse.json(await storage.getMessages(id));
}
