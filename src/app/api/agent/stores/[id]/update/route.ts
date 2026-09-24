import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { requireAgentAuth, assertSessionOwnership } from "@/lib/agent/auth";
import { generateStoreFromBrief } from "@/lib/agent/generate";
import { getEntryCode } from "@/lib/project-files";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/agent/stores/[id]/update — Iterate on a store with a message.
 * Auth: Authorization: Bearer sb_pat_...
 * Body: { message: string, provider?: string, model?: string, apiKey?: string }
 * Regenerates from the latest version's code + the message, saves a new version.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAgentAuth(req);
  if ("response" in authResult) return authResult.response;
  const { tenantId } = authResult.auth;

  const { id: sessionId } = await params;
  if (!(await assertSessionOwnership(sessionId, tenantId))) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const versions = await storage.getVersions(sessionId).catch(() => []);
  const latest = versions[versions.length - 1];
  const previousCode = latest?.code || null;

  // Rebuild a minimal brief from the session for system-prompt context.
  // The message itself carries the edit instruction.
  const session = await storage.getSession(sessionId);
  const brief = {
    storeName: session?.title || "Store",
    tagline: "",
    vibe: "clean" as const,
    designStyle: "clean" as const,
    products: [],
  };

  const provider =
    typeof body.provider === "string" ? body.provider : "xai";
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim().slice(0, 80)
      : undefined;
  const apiKey =
    typeof body.apiKey === "string" && body.apiKey.trim()
      ? body.apiKey.trim()
      : undefined;

  await storage.createMessage({
    id: crypto.randomUUID(),
    sessionId,
    role: "user",
    content: message.slice(0, 8000),
  });

  const result = await generateStoreFromBrief({
    brief,
    provider,
    model,
    apiKey,
    previousCode,
    message,
  });

  if (!result.ok || !result.code) {
    await storage.createMessage({
      id: crypto.randomUUID(),
      sessionId,
      role: "assistant",
      content: `Update failed: ${result.error || "no code"}`,
    });
    return NextResponse.json(
      { error: result.error || "Update failed", storeId: sessionId },
      { status: 500 },
    );
  }

  await storage.createMessage({
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant",
    content: result.text.slice(0, 8000),
  });

  const version = await storage.createVersion({
    id: crypto.randomUUID(),
    sessionId,
    code: result.code,
    title: `v${versions.length + 1} · ${message.slice(0, 40)}`,
    language: "tsx",
    prompt: message.slice(0, 500),
  });

  // Entry code for callers that want the single-file component
  let entryCode: string | null = null;
  try {
    entryCode = getEntryCode(result.code) || null;
  } catch {
    entryCode = null;
  }

  return NextResponse.json({
    storeId: sessionId,
    versionId: version.id,
    versionNumber: versions.length + 1,
    code: result.code,
    entryCode,
    previewUrl: `/studio?p=${sessionId}`,
    integrity: {
      ok: result.integrity.ok,
      repaired: result.integrity.repairedFiles,
      issues: result.integrity.issues.map((i) => ({
        severity: i.severity,
        code: i.code,
        message: i.message,
      })),
    },
  });
}
