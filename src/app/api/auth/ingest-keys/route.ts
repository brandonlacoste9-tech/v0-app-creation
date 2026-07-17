import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";
import {
  createIngestKey,
  listIngestKeys,
  revokeIngestKey,
  sessionBelongsToTenant,
} from "@/lib/tenant-auth";

export const runtime = "nodejs";

/** List ingest keys for current tenant (optional ?projectId=). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const projectId =
    new URL(req.url).searchParams.get("projectId") || undefined;
  const keys = await listIngestKeys(user.id, projectId);
  return NextResponse.json({ keys });
}

/**
 * Create project ingest key for ejected app telemetry.
 * Body: { projectId: sessionId, name? }
 * Returns raw key once → SHIPBOARD_INGEST_KEY
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { projectId?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // Project must exist and belong to this tenant
  const session = await storage.getSession(projectId);
  if (!session) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const owned = await sessionBelongsToTenant(projectId, user.id);
  // Allow if session has no user_id yet (legacy) — claim by requiring sign-in only
  // For beta lockdown: require ownership when user_id is set
  if (!owned) {
    // Try attach: if session is unowned, still allow for signed-in user generating key for their active project
    const sqlOwned = await sessionBelongsToTenant(projectId, user.id);
    if (!sqlOwned) {
      // Memory / unowned sessions: permit when user is signed in (beta)
      // Production with Postgres: only if user_id matches
      if (process.env.DATABASE_URL) {
        // Double-check unowned
        const { neon } = await import("@neondatabase/serverless");
        const sql = neon(process.env.DATABASE_URL);
        const rows = await sql`
          SELECT user_id FROM adgen_sessions WHERE id = ${projectId} LIMIT 1
        `;
        const uid = rows[0]?.user_id;
        if (uid && String(uid) !== user.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }
  }

  const { key, raw } = await createIngestKey(
    user.id,
    projectId,
    body.name || "Project ingest"
  );

  return NextResponse.json({
    key,
    raw,
    projectId,
    env: {
      SHIPBOARD_PROJECT_ID: projectId,
      SHIPBOARD_INGEST_KEY: raw,
      SHIPBOARD_TELEMETRY_URL: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""}/api/telemetry/events`,
    },
    warning:
      "Copy SHIPBOARD_INGEST_KEY now. It will not be shown again. Put it in the ejected app .env.local only.",
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = await revokeIngestKey(user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
