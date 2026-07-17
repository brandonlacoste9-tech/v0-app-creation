import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";
import { storage } from "@/lib/storage";
import { generationsLimitFor, normalizePlan } from "@/lib/plans";
import {
  getGitHubCallbackUrl,
  isGitHubOAuthConfigured,
  shouldSendGitHubRedirectUri,
} from "@/lib/github-oauth";
import { isGoogleOAuthConfigured } from "@/lib/auth-session";

export async function GET() {
  const oauthConfigured = isGitHubOAuthConfigured();
  let oauthCallbackUrl: string | undefined;
  try {
    if (oauthConfigured) oauthCallbackUrl = getGitHubCallbackUrl();
  } catch {
    oauthCallbackUrl = undefined;
  }
  const authProviders = {
    github: oauthConfigured,
    google: isGoogleOAuthConfigured(),
  };

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
        oauthCallbackUrl,
        sendingRedirectUri: shouldSendGitHubRedirectUri(),
        authProviders,
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
      oauthCallbackUrl,
      sendingRedirectUri: shouldSendGitHubRedirectUri(),
      authProviders,
      patSupported: true,
    });
  }
  return NextResponse.json({
    connected: false,
    oauthConfigured,
    oauthCallbackUrl,
    sendingRedirectUri: shouldSendGitHubRedirectUri(),
    authProviders,
    patSupported: true,
  });
}
