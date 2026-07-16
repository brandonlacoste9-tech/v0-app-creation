import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";
import { getAnonSession } from "@/lib/anon-session";
import {
  ALL_PROVIDERS,
  FREE_GENERATIONS_PER_DAY,
  FREE_PROJECT_LIMIT,
  FREE_PROVIDERS,
} from "@/lib/limits";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    const anon = await getAnonSession();
    // Live DB count so deletes free up free-tier slots immediately
    const liveCount = (await storage.getSessions()).length;
    const isPro = anon.plan === "pro";
    return NextResponse.json({
      plan: isPro ? "pro" : "free",
      generationsToday: isPro ? 0 : anon.generationsToday,
      generationsLimit: isPro ? null : FREE_GENERATIONS_PER_DAY,
      projectCount: liveCount,
      projectLimit: isPro ? null : FREE_PROJECT_LIMIT,
      providers: [...FREE_PROVIDERS],
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
  const isPro = refreshed?.plan === "pro";

  return NextResponse.json({
    plan: refreshed?.plan ?? "free",
    generationsToday: refreshed?.generationCountToday ?? 0,
    generationsLimit: isPro ? null : FREE_GENERATIONS_PER_DAY,
    projectCount: sessionCount,
    projectLimit: isPro ? null : FREE_PROJECT_LIMIT,
    providers: isPro ? [...ALL_PROVIDERS] : [...FREE_PROVIDERS],
    connected: true,
    username: user.githubUsername,
    avatarUrl: user.avatarUrl,
    serverKeys: {
      groq: Boolean(process.env.GROQ_API_KEY?.trim()),
      xai: Boolean(process.env.XAI_API_KEY?.trim()),
    },
  });
}
