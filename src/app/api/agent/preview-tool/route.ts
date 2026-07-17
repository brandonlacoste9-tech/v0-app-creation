import { NextResponse } from "next/server";
import type { DatabaseSchemaMap } from "@/lib/byob/types";
import { generatePreviewActionsInline } from "@/lib/byob/preview-intercept";
import { getCurrentUser } from "@/lib/get-user";
import { checkAndConsume } from "@/lib/economic-limits";
import { getAnonSession } from "@/lib/anon-session";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Phase C preview: execute a single DB tool against in-memory preview store.
 * Economic limit: agent_preview per tenant/day.
 */
export async function POST(req: Request) {
  let body: {
    tool?: string;
    args?: Record<string, unknown>;
    schema?: DatabaseSchemaMap;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tool = body.tool?.trim();
  const schema = body.schema;
  if (!tool) {
    return NextResponse.json({ error: "tool name required" }, { status: 400 });
  }
  if (!schema?.tables?.length) {
    return NextResponse.json(
      { error: "schema required for DB tool preview" },
      { status: 400 }
    );
  }

  // Tenant for quotas
  const user = await getCurrentUser();
  let tenantId = user?.id;
  let plan = user?.plan ?? "free";
  if (!tenantId) {
    const anon = await getAnonSession();
    tenantId = `anon:${anon.id || "guest"}`;
    plan = anon.plan || "free";
  }

  const econ = await checkAndConsume(tenantId, plan, "agent_preview", 1);
  if (!econ.allowed) {
    return NextResponse.json(
      {
        error: econ.error,
        code: econ.code,
        upgrade: econ.upgrade,
        usage: econ.usage,
      },
      { status: 429 }
    );
  }

  // Sanitize tool name (identifier only)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tool)) {
    return NextResponse.json({ error: "Invalid tool name" }, { status: 400 });
  }

  const inline = generatePreviewActionsInline(schema);
  const args = body.args ?? {};

  try {
    // eslint-disable-next-line no-new-func
    const runner = new Function(
      "args",
      `${inline}
      if (typeof ${tool} !== "function") {
        throw new Error("Unknown tool: ${tool}");
      }
      return ${tool}(args.limit != null ? args.limit : args.id != null ? args.id : args.data != null ? args : args);
      `
    );

    let result: unknown;
    if (tool.startsWith("update") && args.id != null) {
      const updateRunner = new Function(
        "id",
        "data",
        `${inline}
        return ${tool}(id, data);
        `
      );
      result = await updateRunner(args.id, args.data ?? args);
    } else if (tool.startsWith("list")) {
      result = await runner({ limit: args.limit });
    } else if (tool.startsWith("get") || tool.startsWith("delete")) {
      result = await runner({ id: args.id });
    } else if (tool.startsWith("create")) {
      result = await runner(args.data ?? args);
    } else {
      result = await runner(args);
    }

    return NextResponse.json({
      ok: true,
      tool,
      result,
      mode: "preview-memory",
      usage: econ.usage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Tool preview failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
