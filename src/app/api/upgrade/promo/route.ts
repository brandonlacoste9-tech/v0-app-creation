import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";
import { resolvePromoGrant } from "@/lib/promo-codes";

/**
 * Apply a promo code.
 * Pro codes → Pro. QA_UNLOCK_CODE → Max (unlimited gens + projects).
 * Works for signed-in users (DB) OR anonymous (cookie unlock). No sign-in required.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = String((body as { code?: string }).code || "").trim();

    if (!raw) {
      return NextResponse.json({ error: "Enter a promo code" }, { status: 400 });
    }

    const grant = resolvePromoGrant(raw);
    if (!grant) {
      return NextResponse.json(
        { error: "Invalid promo code. Check spelling and try again." },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    const message =
      grant.kind === "qa"
        ? "Max unlocked — unlimited generations and projects on this session."
        : "Pro unlocked — 120 gens/day, all providers, brand kit.";

    if (user) {
      await storage.updateUser(user.id, { plan: grant.plan });
      return NextResponse.json({
        success: true,
        plan: grant.plan,
        kind: grant.kind,
        message,
      });
    }

    const anon = await getAnonSession();
    anon.plan = grant.plan;
    anon.promoCode = grant.kind === "qa" ? "qa" : raw.toUpperCase();
    anon.generationsToday = 0;
    await saveAnonSession(anon);

    return NextResponse.json({
      success: true,
      plan: grant.plan,
      kind: grant.kind,
      message,
    });
  } catch (error) {
    console.error("Promo code error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
