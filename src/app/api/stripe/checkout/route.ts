import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";
const STRIPE_PRICE_ID_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL ?? "";

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
  const billing = (body as { billing?: string }).billing === "annual" ? "annual" : "monthly";
  const priceId =
    billing === "annual"
      ? STRIPE_PRICE_ID_ANNUAL || STRIPE_PRICE_ID
      : STRIPE_PRICE_ID || STRIPE_PRICE_ID_ANNUAL;

  if (!priceId) {
    return NextResponse.json(
      { error: "Set STRIPE_PRICE_ID (and optional STRIPE_PRICE_ID_ANNUAL) in env." },
      { status: 500 }
    );
  }

  try {
    // Create Stripe customer if needed
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
      success_url: `${origin}/studio?upgraded=true`,
      cancel_url: `${origin}/studio`,
      "metadata[user_id]": user.id,
      "subscription_data[metadata][user_id]": user.id,
      allow_promotion_codes: "true",
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Checkout failed";
    console.error("Stripe checkout error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
