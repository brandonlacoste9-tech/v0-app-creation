import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";

export async function GET() {
  return NextResponse.json(await storage.getSessions());
}

export async function POST(req: Request) {
  const data = await req.json();

  const user = await getCurrentUser();
  if (user && user.plan === "pro") {
    data.userId = user.id;
  } else if (user && user.plan === "free") {
    const count = await storage.getUserSessionCount(user.id);
    if (count >= 3) {
      return NextResponse.json(
        { error: "Project limit reached. Upgrade to Pro for unlimited projects.", upgrade: true },
        { status: 403 }
      );
    }
    data.userId = user.id;
  } else {
    // Anonymous: check cookie limit
    const anon = await getAnonSession();
    if (anon.projectCount >= 3) {
      return NextResponse.json(
        { error: "Project limit reached. Sign in with GitHub and upgrade to Pro for unlimited projects.", upgrade: true, needsAuth: true },
        { status: 403 }
      );
    }
  }

  const session = await storage.createSession(data);

  // Increment anonymous project count after successful creation
  if (!user) {
    const anon = await getAnonSession();
    anon.projectCount++;
    await saveAnonSession(anon);
  }

  return NextResponse.json(session);
}
