import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// One-time migration endpoint to create missing tables
// Can be removed after first successful run
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "No DATABASE_URL" }, { status: 500 });

  const sql = neon(url);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS adgen_users (
        id TEXT PRIMARY KEY,
        github_id TEXT UNIQUE NOT NULL,
        github_username TEXT NOT NULL,
        avatar_url TEXT DEFAULT '',
        email TEXT DEFAULT '',
        stripe_customer_id TEXT,
        plan TEXT NOT NULL DEFAULT 'free',
        generation_count_today INTEGER NOT NULL DEFAULT 0,
        generation_reset_date TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await sql`
      DO $$ BEGIN
        ALTER TABLE adgen_sessions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES adgen_users(id);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `;

    // Verify
    const count = await sql`SELECT COUNT(*) as c FROM adgen_users`;
    return NextResponse.json({ ok: true, userCount: count[0].c, message: "adgen_users table created" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Migration failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
