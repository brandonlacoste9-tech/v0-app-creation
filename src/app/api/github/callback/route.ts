import { setGitHubToken } from "@/lib/github-token";
import { storage } from "@/lib/storage";
import { getGitHubCallbackUrl } from "@/lib/github-oauth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (error) {
    const msg = errorDescription || error;
    return new Response(
      `<html><body style="font-family:system-ui;padding:2rem;background:#0a0a0a;color:#f2f2f2">
        <h1 style="color:#fca5a5">GitHub sign-in failed</h1>
        <p>${escapeHtml(msg)}</p>
        <p style="color:#a1a1aa;font-size:14px">If you saw <em>redirect_uri is not associated</em>, update the OAuth App callback URL to match this app’s <code>NEXT_PUBLIC_APP_URL</code> + <code>/api/github/callback</code>.</p>
        <p><a href="/" style="color:#fb923c">Back to AdGenAI</a></p>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!code || !clientId || !clientSecret) {
    return new Response("Missing code or GitHub credentials", { status: 400 });
  }

  let redirectUri: string;
  try {
    redirectUri = getGitHubCallbackUrl(url.origin);
  } catch {
    redirectUri = `${url.origin}/api/github/callback`;
  }

  try {
    // Exchange code for token — redirect_uri must match authorize step
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenData.access_token) {
      const detail =
        tokenData.error_description ||
        tokenData.error ||
        "Failed to get access token";
      return new Response(
        `OAuth token exchange failed: ${detail}. Callback used: ${redirectUri}`,
        { status: 400 }
      );
    }

    // Get user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "adgenai",
      },
    });
    const userData = (await userRes.json()) as {
      login: string;
      avatar_url: string;
      id: number;
      email?: string;
    };

    // Store token in encrypted cookie
    await setGitHubToken({
      accessToken: tokenData.access_token,
      username: userData.login,
      avatarUrl: userData.avatar_url,
    });

    // Auto-create user in database if not exists
    try {
      const existing = await storage.getUser(userData.login);
      if (!existing) {
        await storage.createUser({
          id: crypto.randomUUID(),
          githubId: String(userData.id),
          githubUsername: userData.login,
          avatarUrl: userData.avatar_url,
          email: userData.email ?? "",
        });
      }
    } catch (e) {
      console.error("Failed to create/check user:", e);
    }

    return new Response(
      `<html><body><script>window.opener&&window.opener.postMessage('github-connected','*');window.close();</script><p style="font-family:system-ui;padding:2rem">Connected! You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return new Response("OAuth failed: " + msg, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
