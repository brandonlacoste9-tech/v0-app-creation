import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

async function migrate() {
  console.log("Running SaaS migration...")

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan_id TEXT NOT NULL DEFAULT 'free',
      plan_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log("Created users table")

  await sql`
    CREATE TABLE IF NOT EXISTS usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      generations_used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, month)
    )
  `
  console.log("Created usage table")

  console.log("SaaS migration complete.")
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
