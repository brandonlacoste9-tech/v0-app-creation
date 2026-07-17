// Cookie-based GitHub token storage for Vercel serverless
// Uses AES-GCM encryption so the access token isn't stored in plaintext cookies

import { cookies } from "next/headers";

const COOKIE_NAME = "gh_token";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface GitHubTokenData {
  accessToken: string;
  username: string;
  avatarUrl: string;
}

// ─── Encryption helpers using Web Crypto ────────────────────

function getSecret(): string {
  return process.env.GITHUB_TOKEN_SECRET || process.env.GITHUB_CLIENT_SECRET || "adgenai-dev-secret-key-change-me!";
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("adgenai-gh-token"), iterations: 100000, hash: "SHA-256" },
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
  // Pack iv + ciphertext as base64
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

// ─── Public API ─────────────────────────────────────────────

export async function setGitHubToken(data: GitHubTokenData): Promise<void> {
  const json = JSON.stringify(data);
  const encrypted = await encrypt(json);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    // Always secure on real hosts (Netlify is production even if NODE_ENV quirks)
    secure: process.env.NODE_ENV === "production" || process.env.NETLIFY === "true",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getGitHubToken(): Promise<GitHubTokenData | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;
    const json = await decrypt(cookie.value);
    return JSON.parse(json) as GitHubTokenData;
  } catch {
    return null;
  }
}

export async function clearGitHubToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
