import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";

export async function GET() {
  return NextResponse.json(await storage.getSessions());
}

export async function POST(req: Request) {
  const data = await req.json();

  // Project limit for logged-in free users
  const user = await getCurrentUser();
  if (user && user.plan === "free") {
    const count = await storage.getUserSessionCount(user.id);
    if (count >= 3) {
      return NextResponse.json(
        { error: "Project limit reached. Upgrade to Pro for unlimited projects.", upgrade: true },
        { status: 403 }
      );
    }
    data.userId = user.id;
  } else if (user) {
    data.userId = user.id;
  }

  const session = await storage.createSession(data);
  return NextResponse.json(session);
}
