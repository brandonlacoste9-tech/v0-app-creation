import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { normalizePlan } from "@/lib/plans";
import { getUsageSnapshot } from "@/lib/economic-limits";
import { extractBearer, resolvePat } from "@/lib/tenant-auth";

export const runtime = "nodejs";

/** Economic quotas + today's usage for the signed-in tenant (or CLI PAT). */
export async function GET(req: Request) {
  let tenantId: string | undefined;
  let plan: string | undefined;

  const user = await getCurrentUser();
  if (user) {
    tenantId = user.id;
    plan = user.plan;
  } else {
    const bearer = extractBearer(req);
    if (bearer?.startsWith("sb_pat_")) {
      const auth = await resolvePat(bearer);
      if (auth) {
        tenantId = auth.tenantId;
        // PAT holders: load plan from storage
        const { storage } = await import("@/lib/storage");
        const u = await storage.getUserById(auth.tenantId);
        plan = u?.plan;
      }
    }
  }

  if (!tenantId) {
    return NextResponse.json({ error: "Sign in or PAT required" }, { status: 401 });
  }

  const usage = await getUsageSnapshot(tenantId, plan ?? "free");
  return NextResponse.json({
    plan: normalizePlan(plan),
    ...usage,
  });
}
