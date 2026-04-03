import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

async function migrate() {
  console.log("Running auth migration...")

  await sql`
    CREATE TABLE IF NOT EXISTS auth_users (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email       TEXT UNIQUE NOT NULL,
      name        TEXT,
      password_hash TEXT,
      provider    TEXT NOT NULL DEFAULT 'email',
      provider_id TEXT,
      avatar_url  TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      reset_token TEXT,
      reset_token_expires_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id    TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token    ON auth_sessions(token)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id  ON auth_sessions(user_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_auth_users_email       ON auth_users(email)
  `

  console.log("Auth migration complete.")
}

migrate().catch((e) => { console.error(e); process.exit(1) })
