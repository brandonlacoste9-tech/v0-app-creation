import { NextResponse } from "next/server";
import {
  getGoogleCallbackUrl,
  isGoogleOAuthConfigured,
} from "@/lib/auth-session";

export async function GET(req: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        googleConfigured: false,
      },
      { status: 503 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const url = new URL(req.url);
  let redirectUri: string;
  try {
    redirectUri = getGoogleCallbackUrl(url.origin);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Set NEXT_PUBLIC_APP_URL for Google",
        googleConfigured: true,
      },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("state", state);

  return NextResponse.json({
    url: authUrl.toString(),
    googleConfigured: true,
    redirectUri,
    hint: "Add this redirectUri in Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs",
  });
}
