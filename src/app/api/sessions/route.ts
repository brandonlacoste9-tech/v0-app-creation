import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";
import { FREE_PROJECT_LIMIT } from "@/lib/limits";

export async function GET() {
  const user = await getCurrentUser();
  // Return only this user's sessions, or anonymous (user_id IS NULL) sessions
  return NextResponse.json(await storage.getSessions(user?.id));
}

export async function POST(req: Request) {
  const data = await req.json();

  const user = await getCurrentUser();
  if (user && user.plan === "pro") {
    data.userId = user.id;
  } else if (user && user.plan === "free") {
    const count = await storage.getUserSessionCount(user.id);
    if (count >= FREE_PROJECT_LIMIT) {
      return NextResponse.json(
        {
          error: `Project limit reached (${FREE_PROJECT_LIMIT} free). Upgrade to Pro for unlimited projects.`,
          upgrade: true,
        },
        { status: 403 }
      );
    }
    data.userId = user.id;
  } else {
    // Anonymous: promo Pro unlock skips project limit
    const anon = await getAnonSession();
    if (anon.plan !== "pro") {
      const liveCount = (await storage.getSessions()).length;
      if (liveCount >= FREE_PROJECT_LIMIT) {
        return NextResponse.json(
          {
            error: `Project limit reached (${FREE_PROJECT_LIMIT} free). Enter a promo code or upgrade to Pro.`,
            upgrade: true,
            needsAuth: false,
          },
          { status: 403 }
        );
      }
    }
  }

  const session = await storage.createSession(data);

  // Keep anonymous cookie in sync after successful creation
  if (!user) {
    const anon = await getAnonSession();
    const liveCount = (await storage.getSessions()).length;
    anon.projectCount = liveCount;
    await saveAnonSession(anon);
  }

  return NextResponse.json(session);
}
