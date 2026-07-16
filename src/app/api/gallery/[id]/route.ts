import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await storage.getGalleryItem(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if ((body as { action?: string }).action === "like") {
    const likes = await storage.likeGalleryItem(id);
    if (!likes && !(await storage.getGalleryItem(id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ likes });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
