import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"

const sql = neon(process.env.DATABASE_URL!)

const SESSION_COOKIE = "adgenai_session"
const SESSION_EXPIRES_DAYS = 30

export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  provider: string
  planId: string
}

// ── Password helpers ──────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ── Session helpers ───────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
  await sql`
    INSERT INTO auth_sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt.toISOString()})
  `
  return token
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const rows = await sql`
    SELECT
      u.id, u.email, u.name, u.avatar_url,
      u.provider,
      COALESCE(us.plan_id, 'free') AS plan_id
    FROM auth_sessions s
    JOIN auth_users u ON u.id = s.user_id
    LEFT JOIN users us ON us.id = u.id
    WHERE s.token = ${token}
      AND s.expires_at > NOW()
  `
  if (!rows[0]) return null
  return {
    id: rows[0].id,
    email: rows[0].email,
    name: rows[0].name,
    avatarUrl: rows[0].avatar_url,
    provider: rows[0].provider,
    planId: rows[0].plan_id,
  }
}

export async function deleteSession(token: string): Promise<void> {
  await sql`DELETE FROM auth_sessions WHERE token = ${token}`
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRES_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value ?? null
}

// ── Current user helper ───────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionTokenFromCookie()
  if (!token) return null
  return getSessionUser(token)
}

// ── User creation ─────────────────────────────────────────────────────────────

export async function createUser(email: string, password: string, name?: string): Promise<AuthUser> {
  const hash = await hashPassword(password)
  const rows = await sql`
    INSERT INTO auth_users (email, password_hash, name, provider)
    VALUES (${email.toLowerCase()}, ${hash}, ${name ?? null}, 'email')
    RETURNING id, email, name, avatar_url, provider
  `
  const u = rows[0]
  // Ensure users row for billing
  await sql`INSERT INTO users (id) VALUES (${u.id}) ON CONFLICT (id) DO NOTHING`
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatar_url, provider: u.provider, planId: "free" }
}

export async function getUserByEmail(email: string) {
  const rows = await sql`
    SELECT id, email, name, password_hash, avatar_url, provider
    FROM auth_users WHERE email = ${email.toLowerCase()}
  `
  return rows[0] ?? null
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function setResetToken(email: string): Promise<string | null> {
  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  const result = await sql`
    UPDATE auth_users
    SET reset_token = ${token}, reset_token_expires_at = ${expires.toISOString()}
    WHERE email = ${email.toLowerCase()}
    RETURNING id
  `
  return result[0] ? token : null
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM auth_users
    WHERE reset_token = ${token}
      AND reset_token_expires_at > NOW()
  `
  if (!rows[0]) return false
  const hash = await hashPassword(newPassword)
  await sql`
    UPDATE auth_users
    SET password_hash = ${hash}, reset_token = NULL, reset_token_expires_at = NULL
    WHERE id = ${rows[0].id}
  `
  return true
}
