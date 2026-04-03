import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// GET /api/user?userId=xxx — fetch user plan + usage
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  // Ensure user row exists
  await sql`
    INSERT INTO users (id) VALUES (${userId})
    ON CONFLICT (id) DO NOTHING
  `

  const users = await sql`SELECT * FROM users WHERE id = ${userId}`
  const user = users[0]

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const usage = await sql`
    SELECT generations_used FROM usage
    WHERE user_id = ${userId} AND month = ${monthKey}
  `
  const generationsUsed = usage[0]?.generations_used ?? 0

  return NextResponse.json({
    planId: user?.plan_id ?? "free",
    stripeCustomerId: user?.stripe_customer_id ?? null,
    stripeSubscriptionId: user?.stripe_subscription_id ?? null,
    generationsUsed: Number(generationsUsed),
  })
}

// POST /api/user — increment generation count
export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  await sql`
    INSERT INTO usage (user_id, month, generations_used)
    VALUES (${userId}, ${monthKey}, 1)
    ON CONFLICT (user_id, month) DO UPDATE SET generations_used = usage.generations_used + 1
  `

  const result = await sql`
    SELECT generations_used FROM usage WHERE user_id = ${userId} AND month = ${monthKey}
  `
  return NextResponse.json({ generationsUsed: Number(result[0]?.generations_used ?? 1) })
}
