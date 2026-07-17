import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import crypto from "crypto";
import {
  normalizePlan,
  planFromMetadata,
  planFromStripePriceId,
  type PlanId,
} from "@/lib/plans";

export const runtime = "nodejs";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";

function isProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NETLIFY === "true"
  );
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const parts = signature.split(",").reduce((acc, part) => {
    const [key, val] = part.split("=");
    acc[key] = val;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts["t"];
  const sig = parts["v1"];
  if (!timestamp || !sig) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function stripeGet(path: string): Promise<Record<string, unknown> | null> {
  if (!STRIPE_SECRET_KEY) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(STRIPE_SECRET_KEY + ":").toString("base64")}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Resolve builder | pro | max from checkout session or subscription. */
async function resolvePaidPlan(obj: {
  metadata?: Record<string, string>;
  subscription?: string | { id?: string; metadata?: Record<string, string> };
  line_items?: unknown;
}): Promise<PlanId> {
  const fromMeta = planFromMetadata(obj.metadata);
  if (fromMeta && fromMeta !== "free") return fromMeta;

  // Subscription object may be expanded or just an id
  const subField = obj.subscription;
  if (subField && typeof subField === "object") {
    const fromSub = planFromMetadata(subField.metadata);
    if (fromSub && fromSub !== "free") return fromSub;
  }
  if (typeof subField === "string" && subField) {
    const sub = await stripeGet(`/subscriptions/${subField}`);
    if (sub) {
      const fromSub = planFromMetadata(sub.metadata as Record<string, string>);
      if (fromSub && fromSub !== "free") return fromSub;
      // First line item price
      const items = sub.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
      const priceId = items?.data?.[0]?.price?.id;
      const fromPrice = planFromStripePriceId(priceId);
      if (fromPrice) return fromPrice;
    }
  }

  return "pro"; // safe default paid if we can't resolve tier
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  // Fail closed in production — never accept unsigned plan upgrades
  if (!STRIPE_WEBHOOK_SECRET) {
    if (isProduction()) {
      console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 503 }
      );
    }
    // Local/dev only: allow without signature when secret unset
  } else if (!verifySignature(body, signature, STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const event = JSON.parse(body) as {
      type: string;
      data: {
        object: {
          id: string;
          customer: string;
          metadata?: Record<string, string>;
          status?: string;
          subscription?: string | { id?: string; metadata?: Record<string, string> };
        };
      };
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const tier = await resolvePaidPlan(session);
        const plan = normalizePlan(tier);

        const apply = async (userId: string) => {
          await storage.updateUser(userId, { plan });
          if (session.customer) {
            const u = await storage.getUserById(userId);
            if (u && !u.stripeCustomerId) {
              await storage.updateUser(userId, { stripeCustomerId: session.customer });
            }
          }
        };

        const userId = session.metadata?.user_id;
        if (userId) {
          const user = await storage.getUserById(userId);
          if (user) await apply(user.id);
        } else if (session.customer) {
          const user = await storage.getUserByStripeCustomerId(session.customer);
          if (user) await apply(user.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        if (sub.customer) {
          const user = await storage.getUserByStripeCustomerId(sub.customer);
          if (user) await storage.updateUser(user.id, { plan: "free" });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        if (sub.customer) {
          const user = await storage.getUserByStripeCustomerId(sub.customer);
          if (user) {
            if (sub.status === "active" || sub.status === "trialing") {
              const tier = await resolvePaidPlan(sub);
              await storage.updateUser(user.id, { plan: normalizePlan(tier) });
            } else {
              await storage.updateUser(user.id, { plan: "free" });
            }
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
