import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

async function migrate() {
  console.log("Running adgenai migrations...")

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New chat',
      starred BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      parts JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      version_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_versions_session ON versions(session_id)`

  console.log("Migrations complete.")
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
