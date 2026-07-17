import { NextResponse } from "next/server";
import {
  getGitHubCallbackUrl,
  isGitHubOAuthConfigured,
} from "@/lib/github-oauth";

export async function GET(req: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or connect with a Personal Access Token in the Push dialog.",
        oauthConfigured: false,
        patSupported: true,
      },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  let redirectUri: string;
  try {
    redirectUri = getGitHubCallbackUrl(url.origin);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Set NEXT_PUBLIC_APP_URL for OAuth callback",
        oauthConfigured: true,
        patSupported: true,
      },
      { status: 500 }
    );
  }

  const scope = "repo,read:user";
  const state = crypto.randomUUID();
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  return NextResponse.json({
    url: authUrl.toString(),
    oauthConfigured: true,
    /** Echo for debugging “redirect_uri not associated” */
    redirectUri,
    hint:
      "This redirectUri must match GitHub OAuth App → Authorization callback URL exactly (https, host, path).",
  });
}
