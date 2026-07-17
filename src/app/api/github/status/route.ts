import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";
import { storage } from "@/lib/storage";
import { generationsLimitFor, normalizePlan } from "@/lib/plans";

export async function GET() {
  const oauthConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim()
  );
  const token = await getGitHubToken();
  if (token) {
    const user = await storage.getUser(token.username);
    if (user) {
      await storage.resetGenerationCountIfNeeded(user.id);
      const refreshed = await storage.getUserById(user.id);
      const plan = normalizePlan(refreshed?.plan);
      return NextResponse.json({
        connected: true,
        username: token.username,
        avatarUrl: token.avatarUrl,
        plan,
        generationsToday: refreshed?.generationCountToday ?? 0,
        generationsLimit: generationsLimitFor(plan),
        oauthConfigured,
        patSupported: true,
      });
    }
    return NextResponse.json({
      connected: true,
      username: token.username,
      avatarUrl: token.avatarUrl,
      plan: "free",
      generationsToday: 0,
      generationsLimit: generationsLimitFor("free"),
      oauthConfigured,
      patSupported: true,
    });
  }
  return NextResponse.json({
    connected: false,
    oauthConfigured,
    patSupported: true,
  });
}
