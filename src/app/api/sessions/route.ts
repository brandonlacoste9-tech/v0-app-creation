import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";
import { FREE_PROJECT_LIMIT } from "@/lib/limits";

export async function GET() {
  const user = await getCurrentUser();
  if (user?.id) {
    return NextResponse.json(await storage.getSessions(user.id));
  }

  // Anonymous: only sessions created in THIS browser (cookie), not every null-user row.
  const anon = await getAnonSession();
  const ids = new Set(anon.sessionIds || []);
  if (ids.size === 0) return NextResponse.json([]);
  const all = await storage.getSessions();
  return NextResponse.json(all.filter((s) => ids.has(s.id)));
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
    // Anonymous: limit is per-browser cookie — NOT global null-user_id count in Postgres.
    const anon = await getAnonSession();
    if (anon.plan !== "pro") {
      const count = (anon.sessionIds || []).length;
      if (count >= FREE_PROJECT_LIMIT) {
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
    const ids = anon.sessionIds || [];
    if (!ids.includes(session.id)) ids.push(session.id);
    anon.sessionIds = ids;
    anon.projectCount = ids.length;
    await saveAnonSession(anon);
  }

  return NextResponse.json(session);
}
