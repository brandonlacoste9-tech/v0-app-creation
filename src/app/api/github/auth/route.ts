import { NextResponse } from "next/server";
import {
  getGitHubCallbackUrl,
  isGitHubOAuthConfigured,
  shouldSendGitHubRedirectUri,
} from "@/lib/github-oauth";

export async function GET(req: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on Netlify.",
        oauthConfigured: false,
        patSupported: true,
      },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  let expectedCallback: string | undefined;
  try {
    expectedCallback = getGitHubCallbackUrl(url.origin);
  } catch {
    expectedCallback = `${url.origin}/api/github/callback`;
  }

  const sendRedirect = shouldSendGitHubRedirectUri();
  const state = crypto.randomUUID();
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  // Only attach redirect_uri when explicitly enabled — otherwise GitHub uses
  // the single URL saved on the OAuth App (prevents "not associated" errors).
  if (sendRedirect && expectedCallback) {
    authUrl.searchParams.set("redirect_uri", expectedCallback);
  }
  authUrl.searchParams.set("scope", "repo,read:user");
  authUrl.searchParams.set("state", state);

  return NextResponse.json({
    url: authUrl.toString(),
    oauthConfigured: true,
    redirectUri: expectedCallback,
    sendingRedirectUri: sendRedirect,
    hint: sendRedirect
      ? "redirect_uri is sent — it must match GitHub OAuth App callback exactly."
      : "redirect_uri omitted — GitHub will use the Authorization callback URL saved on your OAuth App. Set that to your production /api/github/callback.",
  });
}
