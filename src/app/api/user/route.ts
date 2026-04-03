import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";

const FREE_PROVIDERS = ["groq"];
const PRO_PROVIDERS = ["groq", "deepseek", "ollama", "openai", "anthropic"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      plan: "free",
      generationsToday: 0,
      generationsLimit: 5,
      projectCount: 0,
      projectLimit: 3,
      providers: FREE_PROVIDERS,
      connected: false,
    });
  }

  await storage.resetGenerationCountIfNeeded(user.id);
  const refreshed = await storage.getUserById(user.id);
  const sessionCount = await storage.getUserSessionCount(user.id);
  const isPro = refreshed?.plan === "pro";

  return NextResponse.json({
    plan: refreshed?.plan ?? "free",
    generationsToday: refreshed?.generationCountToday ?? 0,
    generationsLimit: isPro ? null : 5,
    projectCount: sessionCount,
    projectLimit: isPro ? null : 3,
    providers: isPro ? PRO_PROVIDERS : FREE_PROVIDERS,
    connected: true,
    username: user.githubUsername,
    avatarUrl: user.avatarUrl,
  });
}
