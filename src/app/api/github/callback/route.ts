import { setGitHubToken } from "@/lib/github-token";
import { storage } from "@/lib/storage";
import {
  getGitHubCallbackUrl,
  shouldSendGitHubRedirectUri,
} from "@/lib/github-oauth";
import { setAuthSession } from "@/lib/auth-session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (error) {
    const msg = errorDescription || error;
    return htmlPage(
      "GitHub sign-in failed",
      `<p style="color:#fca5a5">${escapeHtml(msg)}</p>
       <p style="color:#a1a1aa;font-size:14px">In GitHub → Developer settings → OAuth Apps, set <strong>Authorization callback URL</strong> to this site’s <code>/api/github/callback</code> (same host as the live site, https, no trailing slash).</p>
       <p><a href="/" style="color:#fb923c">Back to Shipboard</a></p>`,
      400
    );
  }

  if (!code || !clientId || !clientSecret) {
    return new Response("Missing code or GitHub credentials", { status: 400 });
  }

  try {
    const body: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    };
    // Only include redirect_uri if we sent it on authorize
    if (shouldSendGitHubRedirectUri()) {
      try {
        body.redirect_uri = getGitHubCallbackUrl(url.origin);
      } catch {
        body.redirect_uri = `${url.origin}/api/github/callback`;
      }
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
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
      return htmlPage(
        "Token exchange failed",
        `<p style="color:#fca5a5">${escapeHtml(detail)}</p>
         <p style="color:#a1a1aa;font-size:13px">Check Client ID/Secret on Netlify match the OAuth App, and callback URL is correct.</p>`,
        400
      );
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "Shipboard",
      },
    });
    const userData = (await userRes.json()) as {
      login: string;
      avatar_url: string;
      id: number;
      email?: string;
    };

    await setGitHubToken({
      accessToken: tokenData.access_token,
      username: userData.login,
      avatarUrl: userData.avatar_url,
    });

    try {
      let existing = await storage.getUser(userData.login);
      if (!existing) {
        existing = await storage.createUser({
          id: crypto.randomUUID(),
          githubId: String(userData.id),
          githubUsername: userData.login,
          avatarUrl: userData.avatar_url,
          email: userData.email ?? "",
        });
      }
      await setAuthSession({
        provider: "github",
        userId: existing.id,
        username: existing.githubUsername,
        avatarUrl: existing.avatarUrl || userData.avatar_url,
        email: existing.email || userData.email || "",
      });
    } catch (e) {
      console.error("Failed to create/check user:", e);
    }

    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Signed in</title></head>
<body style="font-family:system-ui;padding:2rem;background:#0a0a0a;color:#f2f2f2;text-align:center">
  <p style="color:#4ade80;font-weight:600">Signed in with GitHub</p>
  <p style="color:#a1a1aa;font-size:14px">You can close this window.</p>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage('github-connected', '*');
        setTimeout(function(){ window.close(); }, 400);
      } else {
        window.location.replace('/');
      }
    } catch (e) {
      window.location.replace('/');
    }
  </script>
</body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return htmlPage("OAuth failed", `<p>${escapeHtml(msg)}</p>`, 500);
  }
}

function htmlPage(title: string, body: string, status: number) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui;padding:2rem;background:#0a0a0a;color:#f2f2f2">
  <h1 style="font-size:1.25rem">${escapeHtml(title)}</h1>
  ${body}
</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
