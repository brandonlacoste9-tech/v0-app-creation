import { NextResponse } from "next/server";
import { introspectPostgres } from "@/lib/byob";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Read-only Postgres introspection (Neon / Supabase / any PG).
 * Connection string is used for this request only — never stored server-side.
 */
export async function POST(req: Request) {
  let body: { connectionString?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const connectionString = body.connectionString?.trim();
  if (!connectionString) {
    return NextResponse.json(
      { error: "connectionString is required" },
      { status: 400 }
    );
  }

  try {
    const schema = await introspectPostgres(connectionString);
    return NextResponse.json({
      schema,
      // Never echo connection string back
      message:
        schema.tableCount > 0
          ? `Mapped ${schema.tableCount} public table(s) on ${schema.provider}`
          : "Connected, but no public tables found",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Introspection failed";
    // Sanitize accidental password leaks in driver errors
    const safe = msg
      .replace(/postgres(ql)?:\/\/[^@\s]+@/gi, "postgresql://***@")
      .replace(/password=[^&\s]+/gi, "password=***");
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
