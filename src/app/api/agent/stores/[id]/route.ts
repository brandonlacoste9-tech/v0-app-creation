import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { requireAgentAuth, assertSessionOwnership } from "@/lib/agent/auth";

export const runtime = "nodejs";

/**
 * GET /api/agent/stores/[id] — Get store details + latest code.
 * Auth: Authorization: Bearer sb_pat_...
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAgentAuth(req);
  if ("response" in authResult) return authResult.response;
  const { tenantId } = authResult.auth;

  const { id } = await params;
  if (!(await assertSessionOwnership(id, tenantId))) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await storage.getSession(id);
  const versions = await storage.getVersions(id).catch(() => []);
  const messages = await storage.getMessages(id).catch(() => []);
  const latest = versions[versions.length - 1];

  return NextResponse.json({
    store: {
      id: session!.id,
      title: session!.title,
      model: session!.model,
      previewUrl: `/studio?p=${id}`,
      versions: versions.map((v) => ({
        id: v.id,
        title: v.title,
        createdAt: v.createdAt,
      })),
      latestVersionId: latest?.id || null,
      code: latest?.code || null,
      messageCount: messages.length,
    },
  });
}
