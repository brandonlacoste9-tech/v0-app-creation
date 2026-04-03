import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";

function stripeAuth() {
  return `Basic ${Buffer.from(STRIPE_SECRET_KEY + ":").toString("base64")}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  try {
    const origin = new URL(req.url).origin;
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: stripeAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: user.stripeCustomerId,
        return_url: `${origin}/`,
      }).toString(),
    });
    const session = await res.json();
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Portal session failed";
    console.error("Stripe portal error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
