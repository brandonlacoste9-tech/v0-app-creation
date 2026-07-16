import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";

export async function GET() {
  const token = await getGitHubToken();
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  try {
    const res = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner",
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "User-Agent": "adgenai",
          Accept: "application/vnd.github+json",
        },
      }
    );
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) {
      const err = data as { message?: string };
      return NextResponse.json(
        { error: err.message || "Failed to list repositories" },
        { status: res.status || 500 }
      );
    }
    const repos = data as Array<{
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      updated_at: string;
      description: string | null;
      html_url: string;
    }>;
    return NextResponse.json(
      repos.map((r) => ({
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
        description: r.description,
        url: r.html_url,
      }))
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
