import { NextResponse } from "next/server";

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const redirectUri = `${appUrl || url.origin}/api/github/callback`;
  const scope = "repo,read:user";
  const state = crypto.randomUUID();
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

  return NextResponse.json({ url: authUrl, oauthConfigured: true });
}
