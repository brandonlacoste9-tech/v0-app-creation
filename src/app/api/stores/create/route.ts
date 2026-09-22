import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";
import {
  getPlanEntitlements,
  normalizePlan,
  projectLimitFor,
} from "@/lib/plans";
import { applyQaUnlockFromRequest } from "@/lib/qa-unlock";
import {
  buildStoreBrief,
  buildStoreUserPrompt,
  StoreBriefError,
} from "@/lib/commerce/store-brief";

export const runtime = "nodejs";

/**
 * Guided store rail: validate the brief, create a session (same project-cap
 * path as POST /api/sessions). The wizard then lands on /studio?p= and the
 * existing ChatPanel auto-sends through POST /api/chat.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let brief;
  try {
    brief = buildStoreBrief(body);
  } catch (err) {
    if (err instanceof StoreBriefError) {
      return NextResponse.json(
        { error: err.message, fields: err.fields },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid store brief" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const sessionId =
    typeof body.sessionId === "string" && /^[0-9a-f-]{8,}$/i.test(body.sessionId)
      ? body.sessionId
      : crypto.randomUUID();
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim().slice(0, 80)
      : "grok-4";

  const data: { id: string; title: string; model: string; userId?: string } = {
    id: sessionId,
    title: brief.storeName.slice(0, 80),
    model,
  };

  if (user) {
    const plan = normalizePlan(user.plan);
    const limit = projectLimitFor(plan);
    if (limit != null) {
      const count = await storage.getUserSessionCount(user.id);
      if (count >= limit) {
        return NextResponse.json(
          {
            error: `Project limit reached (${limit} on ${getPlanEntitlements(plan).name}). Upgrade to Builder+ for unlimited projects.`,
            upgrade: true,
          },
          { status: 403 }
        );
      }
    }
    data.userId = user.id;
  } else {
    let anon = await getAnonSession();
    anon = (await applyQaUnlockFromRequest(req, anon)) ?? anon;
    const plan = normalizePlan(anon.plan);
    const limit = projectLimitFor(plan);
    if (limit != null) {
      const count = (anon.sessionIds || []).length;
      if (count >= limit) {
        return NextResponse.json(
          {
            error: `Project limit reached (${limit} free). Upgrade to Builder+ for unlimited projects, or enter a promo code.`,
            upgrade: true,
            needsAuth: false,
          },
          { status: 403 }
        );
      }
    }
  }

  const session = await storage.createSession(data);

  if (!user) {
    const anon = await getAnonSession();
    const ids = anon.sessionIds || [];
    if (!ids.includes(session.id)) ids.push(session.id);
    anon.sessionIds = ids;
    anon.projectCount = ids.length;
    await saveAnonSession(anon);
  }

  return NextResponse.json({
    sessionId: session.id,
    prompt: buildStoreUserPrompt(brief),
    designStyle: brief.designStyle,
    storeBrief: brief,
  });
}
