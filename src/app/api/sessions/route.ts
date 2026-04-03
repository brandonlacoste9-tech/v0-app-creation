import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(await storage.getSessions());
}

export async function POST(req: Request) {
  const data = await req.json();
  const session = await storage.createSession(data);
  return NextResponse.json(session);
}
