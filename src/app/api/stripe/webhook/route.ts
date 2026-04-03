import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import crypto from "crypto";

export const runtime = "nodejs";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) return true; // Skip verification in dev
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
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  if (STRIPE_WEBHOOK_SECRET && !verifySignature(body, signature, STRIPE_WEBHOOK_SECRET)) {
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
        };
      };
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        if (userId) {
          const user = await storage.getUserById(userId);
          if (user) {
            await storage.updateUser(user.id, { plan: "pro" });
            if (!user.stripeCustomerId && session.customer) {
              await storage.updateUser(user.id, { stripeCustomerId: session.customer });
            }
          }
        } else if (session.customer) {
          const user = await storage.getUserByStripeCustomerId(session.customer);
          if (user) await storage.updateUser(user.id, { plan: "pro" });
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
            const plan = sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
            await storage.updateUser(user.id, { plan });
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
