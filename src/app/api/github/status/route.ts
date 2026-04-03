import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";
import { storage } from "@/lib/storage";

export async function GET() {
  const token = await getGitHubToken();
  if (token) {
    const user = await storage.getUser(token.username);
    if (user) {
      await storage.resetGenerationCountIfNeeded(user.id);
      const refreshed = await storage.getUserById(user.id);
      return NextResponse.json({
        connected: true,
        username: token.username,
        avatarUrl: token.avatarUrl,
        plan: refreshed?.plan ?? "free",
        generationsToday: refreshed?.generationCountToday ?? 0,
        generationsLimit: refreshed?.plan === "pro" ? null : 5,
      });
    }
    return NextResponse.json({ connected: true, username: token.username, avatarUrl: token.avatarUrl, plan: "free", generationsToday: 0, generationsLimit: 5 });
  }
  return NextResponse.json({ connected: false });
}
