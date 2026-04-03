import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

async function migrate() {
  console.log("[v0] Running Drizzle-compatible schema migration...")

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      avatar_url TEXT,
      stripe_customer_id TEXT,
      plan_id TEXT NOT NULL DEFAULT 'free',
      plan_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log("[v0] users table ready")

  await sql`
    CREATE TABLE IF NOT EXISTS usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      generations_used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, month)
    )
  `
  console.log("[v0] usage table ready")

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled Project',
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log("[v0] projects table ready")

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log("[v0] messages table ready")

  console.log("[v0] Migration complete!")
}

migrate().catch((err) => {
  console.error("[v0] Migration failed:", err)
  process.exit(1)
})
