import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";
import {
  getStripePriceIdForPlan,
  isPaidPlanId,
  type PaidPlanId,
} from "@/lib/pricing";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";

function stripeAuth() {
  return `Basic ${Buffer.from(STRIPE_SECRET_KEY + ":").toString("base64")}`;
}

async function stripePost(endpoint: string, body: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: stripeAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Stripe ${endpoint}: ${data.error.message || JSON.stringify(data.error)}`);
  }
  return data;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in with GitHub to upgrade via Stripe.", needsAuth: true },
      { status: 401 }
    );
  }

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  // Support legacy { billing: "monthly" | "annual" } → builder / pro fallback
  let plan: PaidPlanId = "pro";
  const rawPlan = (body as { plan?: string }).plan;
  if (isPaidPlanId(rawPlan)) {
    plan = rawPlan;
  } else if ((body as { billing?: string }).billing === "annual") {
    // No annual prices yet — use Pro as default paid
    plan = "pro";
  } else if ((body as { billing?: string }).billing === "monthly") {
    plan = "builder";
  }

  const priceId = getStripePriceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Missing Stripe price for ${plan}. Set STRIPE_PRICE_ID_BUILDER / _PRO / _MAX.`,
      },
      { status: 500 }
    );
  }

  try {
    let customerId: string | null = user.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripePost("/customers", {
        email: user.email || "",
        name: user.githubUsername,
        "metadata[user_id]": user.id,
      });
      customerId = customer.id;
      await storage.updateUser(user.id, { stripeCustomerId: customerId });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const session = await stripePost("/checkout/sessions", {
      customer: customerId!,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      success_url: `${origin}/studio?upgraded=true&plan=${plan}`,
      cancel_url: `${origin}/studio`,
      "metadata[user_id]": user.id,
      "metadata[plan_tier]": plan,
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][plan_tier]": plan,
      allow_promotion_codes: "true",
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url, plan });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Checkout failed";
    console.error("Stripe checkout error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
