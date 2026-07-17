import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";
import { isValidProCode } from "@/lib/promo-codes";

/**
 * Apply a promo code → Pro plan.
 * Works for signed-in GitHub users (DB) OR anonymous (cookie unlock).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = String((body as { code?: string }).code || "");
    const code = raw.toUpperCase().trim();

    if (!code) {
      return NextResponse.json({ error: "Enter a promo code" }, { status: 400 });
    }

    if (!isValidProCode(code)) {
      return NextResponse.json(
        { error: "Invalid promo code. Check spelling and try again." },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();

    if (user) {
      await storage.updateUser(user.id, { plan: "pro" });
      return NextResponse.json({
        success: true,
        plan: "pro",
        message: "Pro unlocked on your GitHub account — 120 gens/day, all providers, brand kit.",
      });
    }

    // Anonymous founder unlock (cookie)
    const anon = await getAnonSession();
    anon.plan = "pro";
    anon.promoCode = code;
    anon.generationsToday = 0;
    await saveAnonSession(anon);

    return NextResponse.json({
      success: true,
      plan: "pro",
      message: "Pro unlocked on this browser — 120 gens/day, all providers, brand kit.",
    });

  } catch (error) {
    console.error("Promo code error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
