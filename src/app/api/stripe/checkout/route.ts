import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID ?? "price_1TIFKiCzqBvMqSYFuPIcXrWr";

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
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
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

    // Create Checkout Session
    const origin = new URL(req.url).origin;
    const session = await stripePost("/checkout/sessions", {
      customer: customerId!,
      "line_items[0][price]": STRIPE_PRICE_ID,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      success_url: `${origin}/?upgraded=true`,
      cancel_url: `${origin}/`,
      "metadata[user_id]": user.id,
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
