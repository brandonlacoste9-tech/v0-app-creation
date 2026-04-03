import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export interface DbSession {
  id: string
  title: string
  starred: boolean
  created_at: string
  updated_at: string
}

export interface DbMessage {
  id: string
  session_id: string
  role: string
  parts: unknown[]
  created_at: string
}

export interface DbVersion {
  id: string
  session_id: string
  title: string
  code: string
  timestamp: string
  version_index: number
  created_at: string
}

// Sessions
export async function getSessions(): Promise<DbSession[]> {
  return sql`SELECT * FROM sessions ORDER BY updated_at DESC` as Promise<DbSession[]>
}

export async function createSession(id: string, title: string): Promise<void> {
  await sql`
    INSERT INTO sessions (id, title) VALUES (${id}, ${title})
    ON CONFLICT (id) DO NOTHING
  `
}

export async function updateSession(id: string, title: string, starred = false): Promise<void> {
  await sql`
    UPDATE sessions SET title = ${title}, starred = ${starred}, updated_at = NOW()
    WHERE id = ${id}
  `
}

export async function deleteSession(id: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE id = ${id}`
}

// Messages
export async function getMessages(sessionId: string): Promise<DbMessage[]> {
  return sql`
    SELECT * FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
  ` as Promise<DbMessage[]>
}

export async function upsertMessages(sessionId: string, messages: Array<{ id: string; role: string; parts: unknown[] }>): Promise<void> {
  for (const msg of messages) {
    await sql`
      INSERT INTO messages (id, session_id, role, parts)
      VALUES (${msg.id}, ${sessionId}, ${msg.role}, ${JSON.stringify(msg.parts)})
      ON CONFLICT (id) DO UPDATE SET parts = EXCLUDED.parts
    `
  }
}

// Versions
export async function getVersions(sessionId: string): Promise<DbVersion[]> {
  return sql`
    SELECT * FROM versions WHERE session_id = ${sessionId} ORDER BY version_index ASC
  ` as Promise<DbVersion[]>
}

export async function createVersion(v: Omit<DbVersion, "created_at">): Promise<void> {
  await sql`
    INSERT INTO versions (id, session_id, title, code, timestamp, version_index)
    VALUES (${v.id}, ${v.session_id}, ${v.title}, ${v.code}, ${v.timestamp}, ${v.version_index})
    ON CONFLICT (id) DO NOTHING
  `
}
