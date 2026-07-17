import { storage } from "@/lib/storage";
import {
  clearGoogleOAuthPending,
  getGoogleCallbackUrl,
  getGoogleOAuthPending,
  getGoogleRedirectUriCandidates,
  googleUsernameFromProfile,
  setAuthSession,
} from "@/lib/auth-session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const returnedState = url.searchParams.get("state");
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (error) {
    return htmlError(
      `Google sign-in cancelled or failed: ${errorDescription || error}`,
      400
    );
  }
  if (!code || !clientId || !clientSecret) {
    return htmlError("Missing code or Google credentials on the server", 400);
  }

  const pending = await getGoogleOAuthPending();
  // Soft state check (still proceed if cookie expired after long consent)
  if (pending.state && returnedState && pending.state !== returnedState) {
    return htmlError(
      "OAuth state mismatch — close this window and try Sign in with Google again.",
      400
    );
  }

  const candidates = getGoogleRedirectUriCandidates(
    url.origin,
    pending.redirectUri
  );
  if (candidates.length === 0) {
    try {
      candidates.push(getGoogleCallbackUrl(url.origin));
    } catch {
      candidates.push(`${url.origin.replace(/\/$/, "")}/api/google/callback`);
    }
  }

  try {
    let accessToken: string | undefined;
    let lastErr = "Failed to get Google access token";

    for (const redirectUri of candidates) {
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
      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
        break;
      }
      lastErr =
        tokenData.error_description ||
        tokenData.error ||
        `Token exchange failed for ${redirectUri}`;
      // invalid_grant often means wrong redirect or code already used — try next candidate
      if (
        tokenData.error === "invalid_grant" ||
        /redirect_uri/i.test(tokenData.error_description || "")
      ) {
        continue;
      }
    }

    if (!accessToken) {
      return htmlError(
        `${lastErr}. Tried redirect URIs: ${candidates.join(" · ")}. Add the exact production callback in Google Cloud Console.`,
        400
      );
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!profileRes.ok) {
      return htmlError("Failed to load Google profile (userinfo)", 400);
    }
    const profile = (await profileRes.json()) as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.id) {
      return htmlError("Google profile missing id", 400);
    }

    const providerKey = `google_${profile.id}`;
    let user = await storage.getUserByProviderId(providerKey);
    if (!user && profile.email) {
      user = await storage.getUserByEmail(profile.email);
    }

    if (!user) {
      let username = googleUsernameFromProfile(profile);
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
      // Link google_ provider id if we matched by email on a GitHub account
      if (user.githubId !== providerKey && !user.githubId.startsWith("google_")) {
        // Keep existing GitHub identity; session still works via userId
      }
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
    await clearGoogleOAuthPending();

    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      url.origin.replace(/\/$/, "");
    const studioUrl = `${appOrigin}/studio?auth=google&ok=1`;

    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Signed in · Shipboard</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#f2f2f2;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{max-width:360px;padding:2rem;border:1px solid #27272a;border-radius:1rem;text-align:center}
    a{color:#fb923c}
    .ok{color:#34d399;font-weight:700}
  </style>
</head>
<body>
  <div class="card">
    <p class="ok">Signed in with Google</p>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.5">Returning to Shipboard…</p>
    <p style="margin-top:1rem;font-size:13px"><a href="${studioUrl}">Open studio</a> if this window does not close.</p>
  </div>
  <script>
    (function () {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage("google-connected", "*");
          window.opener.postMessage({ type: "shipboard-auth", provider: "google" }, "*");
          setTimeout(function () { window.close(); }, 400);
          return;
        }
      } catch (e) {}
      window.location.replace(${JSON.stringify(studioUrl)});
    })();
  </script>
</body>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          // Ensure Set-Cookie from setAuthSession is not blocked by caching
          "Cache-Control": "no-store",
        },
      }
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
  const expected =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/google/callback`
      : "{NEXT_PUBLIC_APP_URL}/api/google/callback");
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Google sign-in failed</title></head>
<body style="font-family:system-ui;padding:2rem;background:#0a0a0a;color:#f2f2f2">
  <h1 style="color:#fca5a5">Google sign-in failed</h1>
  <p>${safe}</p>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.55">
    In <strong>Google Cloud Console → Credentials → OAuth client</strong>, Authorized redirect URIs must include exactly:<br/>
    <code style="color:#fb923c">${safeHtml(expected)}</code>
  </p>
  <p style="color:#a1a1aa;font-size:13px">Also set Netlify env <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and <code>NEXT_PUBLIC_APP_URL</code> (same host as above).</p>
  <p><a href="/studio" style="color:#fb923c">Back to Shipboard studio</a></p>
</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function safeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
