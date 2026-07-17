/**
 * Unified Shipboard identity session (GitHub or Google).
 * GitHub push still uses gh_token cookie separately when provider is github.
 */
import { cookies } from "next/headers";

const COOKIE_NAME = "adgen_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type AuthProvider = "github" | "google";

export interface AuthSession {
  provider: AuthProvider;
  userId: string;
  username: string;
  avatarUrl: string;
  email: string;
}

function getSecret(): string {
  return (
    process.env.AUTH_COOKIE_SECRET ||
    process.env.GITHUB_TOKEN_SECRET ||
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    "Shipboard-dev-secret-key-change-me!"
  );
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("Shipboard-auth-session"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(data: string): Promise<string> {
  const key = await deriveKey(getSecret());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(data)
  );
  const packed = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(packed).toString("base64");
}

async function decrypt(encoded: string): Promise<string> {
  const key = await deriveKey(getSecret());
  const packed = new Uint8Array(Buffer.from(encoded, "base64"));
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

export async function setAuthSession(data: AuthSession): Promise<void> {
  const encrypted = await encrypt(JSON.stringify(data));
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.NETLIFY === "true",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;
    const json = await decrypt(cookie.value);
    return JSON.parse(json) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Normalize origin (no trailing slash). */
function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/$/, "");
}

/**
 * Canonical Google redirect URI (authorize + token exchange must match exactly).
 * Prefer GOOGLE_REDIRECT_URI, then NEXT_PUBLIC_APP_URL, then request origin.
 */
export function getGoogleCallbackUrl(requestOrigin?: string): string {
  const full = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (full?.includes("/api/google/callback")) {
    return full.replace(/\/$/, "");
  }
  const origin = normalizeOrigin(
    process.env.NEXT_PUBLIC_APP_URL || requestOrigin || ""
  );
  if (!origin) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL for Google OAuth (e.g. https://www.shipboard.ca)"
    );
  }
  return `${origin}/api/google/callback`;
}

/**
 * Candidates for token exchange when env/host mismatch (www vs apex).
 * Order: cookie/env canonical first, then request origin.
 */
export function getGoogleRedirectUriCandidates(
  requestOrigin?: string,
  preferred?: string | null
): string[] {
  const list: string[] = [];
  const push = (u: string | undefined | null) => {
    if (!u) return;
    const n = u.replace(/\/$/, "");
    if (n.includes("/api/google/callback") && !list.includes(n)) list.push(n);
    else if (!n.includes("/api/") && n.startsWith("http")) {
      const full = `${normalizeOrigin(n)}/api/google/callback`;
      if (!list.includes(full)) list.push(full);
    }
  };
  push(preferred);
  push(process.env.GOOGLE_REDIRECT_URI);
  push(process.env.NEXT_PUBLIC_APP_URL);
  if (requestOrigin) {
    push(requestOrigin);
    // www ↔ apex swap
    try {
      const u = new URL(requestOrigin);
      if (u.hostname.startsWith("www.")) {
        push(`${u.protocol}//${u.hostname.slice(4)}`);
      } else {
        push(`${u.protocol}//www.${u.hostname}`);
      }
    } catch {
      /* ignore */
    }
  }
  return list;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

const GOOGLE_OAUTH_REDIRECT_COOKIE = "google_oauth_redirect";
const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

/** Persist redirect_uri + state for the OAuth round-trip (10 min). */
export async function setGoogleOAuthPending(opts: {
  redirectUri: string;
  state: string;
}): Promise<void> {
  const cookieStore = await cookies();
  const secure =
    process.env.NODE_ENV === "production" || process.env.NETLIFY === "true";
  const base = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  cookieStore.set(GOOGLE_OAUTH_REDIRECT_COOKIE, opts.redirectUri, base);
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, opts.state, base);
}

export async function getGoogleOAuthPending(): Promise<{
  redirectUri: string | null;
  state: string | null;
}> {
  const cookieStore = await cookies();
  return {
    redirectUri: cookieStore.get(GOOGLE_OAUTH_REDIRECT_COOKIE)?.value ?? null,
    state: cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null,
  };
}

export async function clearGoogleOAuthPending(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GOOGLE_OAUTH_REDIRECT_COOKIE);
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);
}

/** Unique username for Google users (github_username column). */
export function googleUsernameFromProfile(profile: {
  email?: string;
  name?: string;
  id: string;
}): string {
  const base =
    profile.email?.split("@")[0] ||
    profile.name?.replace(/\s+/g, "").toLowerCase() ||
    `user${profile.id.slice(0, 8)}`;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32) || "user";
  return cleaned;
}
