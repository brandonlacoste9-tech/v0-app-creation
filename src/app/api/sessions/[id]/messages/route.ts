import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await storage.getMessages(id));
}
