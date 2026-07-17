/**
 * Unified AdGen identity session (GitHub or Google).
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
    "adgenai-dev-secret-key-change-me!"
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
      salt: enc.encode("adgenai-auth-session"),
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

export function getGoogleCallbackUrl(requestOrigin?: string): string {
  const full = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (full?.includes("/api/google/callback")) {
    return full.replace(/\/$/, "");
  }
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    requestOrigin ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!origin) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL for Google OAuth (e.g. https://www.adgenai.ca)"
    );
  }
  return `${origin}/api/google/callback`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
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
