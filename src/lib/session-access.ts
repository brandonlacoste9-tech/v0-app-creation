/**
 * Session ownership checks for API routes.
 * Signed-in users may only touch their own sessions.
 * Anonymous users may only touch session IDs listed in their browser cookie.
 */
import { storage, type Session } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession } from "@/lib/anon-session";

export type SessionAccessOk = { ok: true; session: Session };
export type SessionAccessDenied = {
  ok: false;
  status: 401 | 403 | 404;
  error: string;
};

export async function assertSessionAccess(
  sessionId: string
): Promise<SessionAccessOk | SessionAccessDenied> {
  if (!sessionId?.trim()) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const session = await storage.getSession(sessionId);
  if (!session) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const user = await getCurrentUser();

  if (user) {
    if (session.userId) {
      if (session.userId === user.id) return { ok: true, session };
      return { ok: false, status: 403, error: "Forbidden" };
    }
    // Orphan / anon-owned row: only if this browser created it
    const anon = await getAnonSession();
    if ((anon.sessionIds || []).includes(sessionId)) {
      return { ok: true, session };
    }
    return { ok: false, status: 403, error: "Forbidden" };
  }

  // Anonymous caller
  if (session.userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const anon = await getAnonSession();
  if ((anon.sessionIds || []).includes(sessionId)) {
    return { ok: true, session };
  }

  return { ok: false, status: 403, error: "Forbidden" };
}
