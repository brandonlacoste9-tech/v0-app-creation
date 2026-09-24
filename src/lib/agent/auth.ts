/**
 * Shared auth for the Agent API (/api/agent/*).
 * API-key auth via Personal Access Tokens: Authorization: Bearer sb_pat_...
 */
import { NextResponse } from "next/server";
import {
  extractBearer,
  resolvePat,
  type AuthContext,
} from "@/lib/tenant-auth";

export interface AgentAuth {
  tenantId: string;
  patId: string;
}

/**
 * Resolve the PAT from the request. Returns the auth context or a 401 response.
 */
export async function requireAgentAuth(
  req: Request,
): Promise<{ auth: AgentAuth } | { response: NextResponse }> {
  const raw = extractBearer(req);
  if (!raw) {
    return {
      response: NextResponse.json(
        {
          error: "API key required",
          hint: "Pass Authorization: Bearer sb_pat_... — create one at /api/auth/tokens (signed in).",
        },
        { status: 401 },
      ),
    };
  }

  let ctx: AuthContext | null = null;
  try {
    ctx = await resolvePat(raw);
  } catch {
    ctx = null;
  }

  if (!ctx) {
    return {
      response: NextResponse.json(
        { error: "Invalid or revoked API key" },
        { status: 401 },
      ),
    };
  }

  return { auth: { tenantId: ctx.tenantId, patId: ctx.patId || "" } };
}

/**
 * Check that a session belongs to the authed tenant.
 */
export async function assertSessionOwnership(
  sessionId: string,
  tenantId: string,
): Promise<boolean> {
  const { storage } = await import("@/lib/storage");
  const session = await storage.getSession(sessionId);
  if (!session) return false;
  // Sessions store userId for signed-in owners; anon sessions have no userId
  // and are not accessible via the agent API.
  return session.userId === tenantId;
}
