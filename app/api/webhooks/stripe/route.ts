import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: "Webhook signature failed" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const userId = session.metadata?.userId
    const planId = session.metadata?.planId
    const customerId = session.customer as string
    const subscriptionId = session.subscription as string

    if (userId && planId) {
      await sql`
        INSERT INTO users (id, stripe_customer_id, stripe_subscription_id, plan_id)
        VALUES (${userId}, ${customerId}, ${subscriptionId}, ${planId})
        ON CONFLICT (id) DO UPDATE SET
          stripe_customer_id = EXCLUDED.stripe_customer_id,
          stripe_subscription_id = EXCLUDED.stripe_subscription_id,
          plan_id = EXCLUDED.plan_id,
          updated_at = NOW()
      `
    }
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object
    const userId = sub.metadata?.userId
    if (userId) {
      const planId =
        sub.status === "active" ? (sub.metadata?.planId ?? "free") : "free"
      await sql`
        UPDATE users SET plan_id = ${planId}, updated_at = NOW() WHERE id = ${userId}
      `
    }
  }

  return NextResponse.json({ received: true })
}
