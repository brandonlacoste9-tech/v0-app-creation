/**
 * GitHub OAuth helpers — redirect_uri must match the OAuth App setting exactly.
 *
 * GitHub OAuth Apps allow ONE Authorization callback URL.
 * Set the same value in:
 *   1. GitHub → Developer settings → OAuth Apps → Authorization callback URL
 *   2. Netlify env NEXT_PUBLIC_APP_URL (or GITHUB_REDIRECT_URI)
 */

/** Canonical public origin, no trailing slash. */
export function getAppOrigin(requestOrigin?: string): string {
  const explicit =
    process.env.GITHUB_REDIRECT_URI?.replace(/\/api\/github\/callback\/?$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL;
  const raw = (explicit || requestOrigin || "").trim().replace(/\/$/, "");
  return raw;
}

/**
 * Exact callback URL sent to GitHub authorize + token exchange.
 * Example: https://www.adgenai.ca/api/github/callback
 */
export function getGitHubCallbackUrl(requestOrigin?: string): string {
  // Full override wins (must include path)
  const full = process.env.GITHUB_REDIRECT_URI?.trim();
  if (full?.includes("/api/github/callback")) {
    return full.replace(/\/$/, "");
  }
  const origin = getAppOrigin(requestOrigin);
  if (!origin) {
    throw new Error(
      "Cannot build GitHub redirect_uri — set NEXT_PUBLIC_APP_URL (e.g. https://www.adgenai.ca)"
    );
  }
  return `${origin}/api/github/callback`;
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() &&
      process.env.GITHUB_CLIENT_SECRET?.trim()
  );
}
