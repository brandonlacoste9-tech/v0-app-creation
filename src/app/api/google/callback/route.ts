import { storage } from "@/lib/storage";
import {
  getGoogleCallbackUrl,
  googleUsernameFromProfile,
  setAuthSession,
} from "@/lib/auth-session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (error) {
    return htmlError(
      `Google sign-in cancelled or failed: ${error}`,
      400
    );
  }
  if (!code || !clientId || !clientSecret) {
    return htmlError("Missing code or Google credentials", 400);
  }

  let redirectUri: string;
  try {
    redirectUri = getGoogleCallbackUrl(url.origin);
  } catch {
    redirectUri = `${url.origin}/api/google/callback`;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenData.access_token) {
      return htmlError(
        tokenData.error_description ||
          tokenData.error ||
          "Failed to get Google access token",
        400
      );
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const profile = (await profileRes.json()) as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.id) {
      return htmlError("Failed to load Google profile", 400);
    }

    const providerKey = `google_${profile.id}`;
    let user = await storage.getUserByProviderId(providerKey);
    if (!user) {
      // Also try lookup by email if we already have a GitHub user with same email
      if (profile.email) {
        user = await storage.getUserByEmail(profile.email);
      }
    }

    if (!user) {
      let username = googleUsernameFromProfile(profile);
      // Ensure unique username
      const existing = await storage.getUser(username);
      if (existing) {
        username = `${username}_${profile.id.slice(0, 6)}`;
      }
      user = await storage.createUser({
        id: crypto.randomUUID(),
        githubId: providerKey,
        githubUsername: username,
        avatarUrl: profile.picture || "",
        email: profile.email || "",
      });
    } else {
      // Refresh avatar/email
      await storage.updateUserProfile(user.id, {
        avatarUrl: profile.picture || user.avatarUrl,
        email: profile.email || user.email,
      });
      user = (await storage.getUserById(user.id)) || user;
    }

    await setAuthSession({
      provider: "google",
      userId: user.id,
      username: user.githubUsername,
      avatarUrl: user.avatarUrl,
      email: user.email,
    });

    return new Response(
      `<html><body><script>window.opener&&window.opener.postMessage('google-connected','*');window.close();</script><p style="font-family:system-ui;padding:2rem">Signed in with Google! You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return htmlError("Google OAuth failed: " + msg, 500);
  }
}

function htmlError(message: string, status: number) {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return new Response(
    `<html><body style="font-family:system-ui;padding:2rem;background:#0a0a0a;color:#f2f2f2">
      <h1 style="color:#fca5a5">Google sign-in failed</h1>
      <p>${safe}</p>
      <p style="color:#a1a1aa;font-size:14px">Authorized redirect URI in Google Cloud must be exactly:<br/>
      <code>{NEXT_PUBLIC_APP_URL}/api/google/callback</code></p>
      <p><a href="/" style="color:#fb923c">Back to Shipboard</a></p>
    </body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
