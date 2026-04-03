import { setGitHubToken } from "@/lib/github-token";
import { storage } from "@/lib/storage";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return new Response("Missing code or GitHub credentials", { status: 400 });
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return new Response("Failed to get access token", { status: 400 });
    }

    // Get user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "adgenai" },
    });
    const userData = (await userRes.json()) as { login: string; avatar_url: string; id: number; email?: string };

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
      `<html><body><script>window.opener&&window.opener.postMessage('github-connected','*');window.close();</script><p>Connected! You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return new Response("OAuth failed: " + msg, { status: 500 });
  }
}
