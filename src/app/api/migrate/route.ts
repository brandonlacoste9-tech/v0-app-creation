import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

/**
 * One-time / admin migration endpoint.
 * Always requires MIGRATE_SECRET (or ADMIN_SECRET) via:
 *   Authorization: Bearer <secret>
 *   or ?secret=<secret>
 * Purge is never available without that secret.
 */
function extractSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return new URL(req.url).searchParams.get("secret");
}

function isAuthorized(req: Request): boolean {
  const expected =
    process.env.MIGRATE_SECRET?.trim() || process.env.ADMIN_SECRET?.trim() || "";
  if (!expected) return false;
  const provided = extractSecret(req);
  return Boolean(provided && provided === expected);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Set MIGRATE_SECRET and pass Authorization: Bearer <secret>.",
      },
      { status: 401 }
    );
  }

  const url2 = new URL(req.url);
  const purge = url2.searchParams.get("purge");

  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "No DATABASE_URL" }, { status: 500 });
  }

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

    if (purge === "all") {
      await sql`DELETE FROM adgen_versions`;
      await sql`DELETE FROM adgen_messages`;
      await sql`DELETE FROM adgen_sessions`;
      return NextResponse.json({
        ok: true,
        message: "All sessions, messages, and versions deleted",
      });
    }

    const count = await sql`SELECT COUNT(*) as c FROM adgen_users`;
    return NextResponse.json({
      ok: true,
      userCount: count[0].c,
      message: "Migration check complete",
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      // Do not leak price IDs in responses
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Migration failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
