import { NextResponse } from "next/server";
import { setGitHubToken, clearGitHubToken } from "@/lib/github-token";
import { storage } from "@/lib/storage";

/**
 * Connect GitHub via Personal Access Token (classic or fine-grained).
 * Scopes needed: repo (create/push repos). Works without OAuth app setup.
 */
export async function POST(req: Request) {
  const { token } = (await req.json()) as { token?: string };
  const accessToken = token?.trim();
  if (!accessToken) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  // Validate token against GitHub API
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "adgenai",
      Accept: "application/vnd.github+json",
    },
  });

  if (!userRes.ok) {
    const err = (await userRes.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json(
      {
        error:
          err.message ||
          "Invalid GitHub token. Create a classic PAT with `repo` scope at github.com/settings/tokens",
      },
      { status: 401 }
    );
  }

  const userData = (await userRes.json()) as {
    login: string;
    avatar_url: string;
    id: number;
    email?: string | null;
  };

  await setGitHubToken({
    accessToken,
    username: userData.login,
    avatarUrl: userData.avatar_url,
  });

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
    console.error("Failed to create/check user from PAT:", e);
  }

  return NextResponse.json({
    connected: true,
    username: userData.login,
    avatarUrl: userData.avatar_url,
  });
}

export async function DELETE() {
  await clearGitHubToken();
  return NextResponse.json({ ok: true });
}
