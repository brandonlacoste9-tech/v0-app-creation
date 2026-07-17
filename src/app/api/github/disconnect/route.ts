import { NextResponse } from "next/server";
import { clearGitHubToken } from "@/lib/github-token";
import { clearAuthSession } from "@/lib/auth-session";

export async function DELETE() {
  await clearGitHubToken();
  await clearAuthSession();
  return NextResponse.json({ ok: true });
}
