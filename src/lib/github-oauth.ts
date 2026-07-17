/**
 * GitHub OAuth helpers.
 *
 * Classic OAuth Apps have ONE Authorization callback URL in GitHub settings.
 * Sending a redirect_uri that doesn't match → "redirect_uri is not associated".
 *
 * Default behavior: do NOT send redirect_uri (GitHub uses the app's registered
 * callback). Only send it when GITHUB_REDIRECT_URI or NEXT_PUBLIC_APP_URL is set
 * AND GITHUB_SEND_REDIRECT_URI=true (strict mode for multi-env).
 *
 * Recommended Netlify + GitHub setup:
 *   GitHub callback:  https://www.adgenai.ca/api/github/callback
 *   NEXT_PUBLIC_APP_URL=https://www.adgenai.ca
 */

export function getAppOrigin(requestOrigin?: string): string {
  const explicit =
    process.env.GITHUB_REDIRECT_URI?.replace(
      /\/api\/github\/callback\/?$/,
      ""
    ) || process.env.NEXT_PUBLIC_APP_URL;
  const raw = (explicit || requestOrigin || "").trim().replace(/\/$/, "");
  return raw;
}

/**
 * Callback URL we expect (for docs / status UI).
 * Not always sent to GitHub (see shouldSendRedirectUri).
 */
export function getGitHubCallbackUrl(requestOrigin?: string): string {
  const full = process.env.GITHUB_REDIRECT_URI?.trim();
  if (full?.includes("/api/github/callback")) {
    return full.replace(/\/$/, "");
  }
  const origin = getAppOrigin(requestOrigin);
  if (!origin) {
    throw new Error(
      "Cannot build GitHub callback URL — set NEXT_PUBLIC_APP_URL (e.g. https://www.adgenai.ca)"
    );
  }
  return `${origin}/api/github/callback`;
}

/**
 * When false, authorize + token exchange omit redirect_uri so GitHub uses
 * whatever is saved on the OAuth App (avoids mismatch errors).
 */
export function shouldSendGitHubRedirectUri(): boolean {
  const flag = process.env.GITHUB_SEND_REDIRECT_URI?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  // Explicit full override → always send so token exchange matches
  if (process.env.GITHUB_REDIRECT_URI?.includes("/api/github/callback")) {
    return true;
  }
  // Default: omit (most reliable for single production OAuth app)
  return false;
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() &&
      process.env.GITHUB_CLIENT_SECRET?.trim()
  );
}
