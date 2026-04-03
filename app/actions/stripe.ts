"use server"

import { stripe } from "@/lib/stripe"
import { PLANS } from "@/lib/plans"
import { headers } from "next/headers"

export async function createCheckoutSession(planId: "pro" | "unlimited", userId: string) {
  const plan = PLANS.find((p) => p.id === planId)
  if (!plan || !plan.stripePriceId) throw new Error("Invalid plan")

  const headersList = await headers()
  const origin = headersList.get("origin") ?? "http://localhost:3000"

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    mode: "subscription",
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    metadata: { userId, planId },
    subscription_data: {
      metadata: { userId, planId },
    },
  })

  return session.client_secret
}

export async function createBillingPortalSession(customerId: string) {
  const headersList = await headers()
  const origin = headersList.get("origin") ?? "http://localhost:3000"

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: origin,
  })

  return session.url
}
