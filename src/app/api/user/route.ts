import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";
import { getAnonSession } from "@/lib/anon-session";
import {
  getPlanEntitlements,
  normalizePlan,
} from "@/lib/plans";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    const anon = await getAnonSession();
    const liveCount = (anon.sessionIds || []).length;
    const plan = normalizePlan(anon.plan);
    const ent = getPlanEntitlements(plan);
    return NextResponse.json({
      plan,
      generationsToday: ent.generationsPerDay == null ? 0 : anon.generationsToday,
      generationsLimit: ent.generationsPerDay,
      projectCount: liveCount,
      projectLimit: ent.projectLimit,
      providers: [...ent.providers],
      brandKit: ent.brandKit,
      versionCompare: ent.versionCompare,
      browserQa: ent.browserQa,
      browserAgent: ent.browserAgent,
      connected: false,
      serverKeys: {
        groq: Boolean(process.env.GROQ_API_KEY?.trim()),
        xai: Boolean(process.env.XAI_API_KEY?.trim()),
      },
    });
  }

  await storage.resetGenerationCountIfNeeded(user.id);
  const refreshed = await storage.getUserById(user.id);
  const sessionCount = await storage.getUserSessionCount(user.id);
  const plan = normalizePlan(refreshed?.plan);
  const ent = getPlanEntitlements(plan);

  return NextResponse.json({
    plan,
    generationsToday: refreshed?.generationCountToday ?? 0,
    generationsLimit: ent.generationsPerDay,
    projectCount: sessionCount,
    projectLimit: ent.projectLimit,
    providers: [...ent.providers],
    brandKit: ent.brandKit,
    versionCompare: ent.versionCompare,
    browserQa: ent.browserQa,
    browserAgent: ent.browserAgent,
    connected: true,
    username: user.githubUsername,
    avatarUrl: user.avatarUrl,
    serverKeys: {
      groq: Boolean(process.env.GROQ_API_KEY?.trim()),
      xai: Boolean(process.env.XAI_API_KEY?.trim()),
    },
  });
}
