import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { requireAgentAuth } from "@/lib/agent/auth";
import { generateStoreFromBrief } from "@/lib/agent/generate";
import {
  buildStoreBrief,
  StoreBriefError,
} from "@/lib/commerce/store-brief";
import {
  getPlanEntitlements,
  normalizePlan,
  projectLimitFor,
} from "@/lib/plans";

export const runtime = "nodejs";
/** Generation takes 30-60s; give it room. */
export const maxDuration = 120;

/**
 * POST /api/agent/stores — Build a whole store from a brief. One call.
 *
 * Auth: Authorization: Bearer sb_pat_...
 * Body: {
 *   storeName: string, tagline?: string, vibe?: "clean"|"atelier"|"street",
 *   products: [{ name, price, priceCents?, description? }],
 *   provider?: "groq"|"xai"|"deepseek"|"openai"|"anthropic",
 *   model?: string, apiKey?: string (provider key override)
 * }
 * Returns: { storeId, title, code, previewUrl, integrity, usage }
 */
export async function POST(req: Request) {
  const authResult = await requireAgentAuth(req);
  if ("response" in authResult) return authResult.response;
  const { tenantId } = authResult.auth;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let brief;
  try {
    brief = buildStoreBrief(body);
  } catch (err) {
    if (err instanceof StoreBriefError) {
      return NextResponse.json(
        { error: err.message, fields: err.fields },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid store brief" }, { status: 400 });
  }

  // Project cap for the tenant's plan
  try {
    const user = await storage.getUserById(tenantId);
    const plan = normalizePlan(user?.plan);
    const limit = projectLimitFor(plan);
    if (limit != null) {
      const count = await storage.getUserSessionCount(tenantId);
      if (count >= limit) {
        return NextResponse.json(
          {
            error: `Project limit reached (${limit} on ${getPlanEntitlements(plan).name}).`,
            upgrade: true,
          },
          { status: 403 },
        );
      }
    }
  } catch {
    /* plan check best-effort */
  }

  const sessionId = crypto.randomUUID();
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

  const session = await storage.createSession({
    id: sessionId,
    title: brief.storeName.slice(0, 80),
    model: model || provider,
    userId: tenantId,
  });

  // Save the user message for history
  const userPrompt = `Build a store: ${brief.storeName} (${brief.vibe}, ${brief.products.length} products)`;
  await storage.createMessage({
    id: crypto.randomUUID(),
    sessionId,
    role: "user",
    content: userPrompt,
  });

  const result = await generateStoreFromBrief({
    brief,
    provider,
    model,
    apiKey,
    previousCode: null,
  });

  if (!result.ok || !result.code) {
    await storage.createMessage({
      id: crypto.randomUUID(),
      sessionId,
      role: "assistant",
      content: `Generation failed: ${result.error || "no code"}`,
    });
    return NextResponse.json(
      {
        error: result.error || "Generation failed",
        storeId: sessionId,
        integrity: {
          ok: result.integrity.ok,
          issues: result.integrity.issues.map((i) => ({
            severity: i.severity,
            code: i.code,
            message: i.message,
          })),
        },
      },
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
    title: `v1 · ${brief.storeName.slice(0, 40)}`,
    language: "tsx",
    prompt: userPrompt,
  });

  return NextResponse.json({
    storeId: sessionId,
    title: session.title,
    versionId: version.id,
    code: result.code,
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

/**
 * GET /api/agent/stores — List stores for the API key's tenant.
 * Returns: { stores: [{ id, title, createdAt, versions }] }
 */
export async function GET(req: Request) {
  const authResult = await requireAgentAuth(req);
  if ("response" in authResult) return authResult.response;
  const { tenantId } = authResult.auth;

  const sessions = await storage.getSessions(tenantId);
  const stores = await Promise.all(
    sessions.map(async (s) => {
      const versions = await storage.getVersions(s.id).catch(() => []);
      return {
        id: s.id,
        title: s.title,
        model: s.model,
        createdAt: (s as { createdAt?: string }).createdAt,
        versions: versions.length,
        latestVersionId: versions[versions.length - 1]?.id || null,
        previewUrl: `/studio?p=${s.id}`,
      };
    }),
  );

  return NextResponse.json({ stores });
}
