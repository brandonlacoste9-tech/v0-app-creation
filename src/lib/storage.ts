// Persistent Postgres storage for Vercel (Neon serverless)
// Falls back to in-memory if DATABASE_URL is not set (local dev)

import { neon } from "@neondatabase/serverless";

export interface Session {
  id: string;
  title: string;
  starred: boolean;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface CodeVersion {
  id: string;
  sessionId: string;
  code: string;
  title: string;
  language: string;
  createdAt: string;
}

export interface GitHubToken {
  id: string;
  accessToken: string;
  username: string;
  avatarUrl: string;
  createdAt: string;
}

export interface User {
  id: string;
  githubId: string;
  githubUsername: string;
  avatarUrl: string;
  email: string;
  stripeCustomerId: string | null;
  plan: "free" | "pro";
  generationCountToday: number;
  generationResetDate: string;
  createdAt: string;
}

// ─── Postgres Storage ────────────────────────────────────────

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

// Version-based migration — increment to force re-run
const MIGRATION_VERSION = 2;
let _migratedVersion = 0;

async function ensureTables() {
  if (_migratedVersion >= MIGRATION_VERSION) return;
  const sql = getSql();
  if (!sql) return;

  await sql`
    CREATE TABLE IF NOT EXISTS adgen_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New project',
      starred BOOLEAN NOT NULL DEFAULT false,
      model TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS adgen_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES adgen_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_adgen_messages_session ON adgen_messages(session_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS adgen_versions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES adgen_sessions(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'tsx',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_adgen_versions_session ON adgen_versions(session_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS adgen_users (
      id TEXT PRIMARY KEY,
      github_id TEXT UNIQUE NOT NULL,
      github_username TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      email TEXT DEFAULT '',
      stripe_customer_id TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      generation_count_today INTEGER NOT NULL DEFAULT 0,
      generation_reset_date TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE adgen_sessions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES adgen_users(id);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `;

  _migratedVersion = MIGRATION_VERSION;
}

class PostgresStorage {
  // Sessions
  async getSessions(userId?: string): Promise<Session[]> {
    await ensureTables();
    const sql = getSql()!;
    let rows;
    if (userId) {
      rows = await sql`
        SELECT id, title, starred, model, created_at, updated_at
        FROM adgen_sessions WHERE user_id = ${userId} ORDER BY updated_at DESC
      `;
    } else {
      rows = await sql`
        SELECT id, title, starred, model, created_at, updated_at
        FROM adgen_sessions WHERE user_id IS NULL ORDER BY updated_at DESC
      `;
    }
    return rows.map(rowToSession);
  }

  async getSession(id: string): Promise<Session | undefined> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`
      SELECT id, title, starred, model, created_at, updated_at
      FROM adgen_sessions WHERE id = ${id}
    `;
    return rows[0] ? rowToSession(rows[0]) : undefined;
  }

  async createSession(data: { id: string; title?: string; model?: string; userId?: string }): Promise<Session> {
    await ensureTables();
    const sql = getSql()!;
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO adgen_sessions (id, title, model, user_id, created_at, updated_at)
      VALUES (${data.id}, ${data.title || "New project"}, ${data.model || ""}, ${data.userId ?? null}, ${now}, ${now})
      RETURNING id, title, starred, model, created_at, updated_at
    `;
    return rowToSession(rows[0]);
  }

  async updateSession(id: string, data: Partial<Session>): Promise<Session | null> {
    await ensureTables();
    const sql = getSql()!;
    const now = new Date().toISOString();
    // Build SET clause dynamically
    const updates: string[] = [];
    const vals: Record<string, unknown> = {};
    if (data.title !== undefined) { updates.push("title"); vals.title = data.title; }
    if (data.starred !== undefined) { updates.push("starred"); vals.starred = data.starred; }
    if (data.model !== undefined) { updates.push("model"); vals.model = data.model; }

    // Use individual queries to avoid template literal SQL injection complexity
    if (data.title !== undefined) await sql`UPDATE adgen_sessions SET title = ${data.title}, updated_at = ${now} WHERE id = ${id}`;
    if (data.starred !== undefined) await sql`UPDATE adgen_sessions SET starred = ${data.starred}, updated_at = ${now} WHERE id = ${id}`;
    if (data.model !== undefined) await sql`UPDATE adgen_sessions SET model = ${data.model}, updated_at = ${now} WHERE id = ${id}`;
    if (updates.length === 0) await sql`UPDATE adgen_sessions SET updated_at = ${now} WHERE id = ${id}`;

    return (await this.getSession(id)) ?? null;
  }

  async deleteSession(id: string): Promise<void> {
    await ensureTables();
    const sql = getSql()!;
    // CASCADE deletes messages and versions
    await sql`DELETE FROM adgen_sessions WHERE id = ${id}`;
  }

  // Messages
  async getMessages(sessionId: string): Promise<Message[]> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`
      SELECT id, session_id, role, content, created_at
      FROM adgen_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
    `;
    return rows.map(rowToMessage);
  }

  async createMessage(data: { id: string; sessionId: string; role: "user" | "assistant"; content: string }): Promise<Message> {
    await ensureTables();
    const sql = getSql()!;
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO adgen_messages (id, session_id, role, content, created_at)
      VALUES (${data.id}, ${data.sessionId}, ${data.role}, ${data.content}, ${now})
      RETURNING id, session_id, role, content, created_at
    `;
    return rowToMessage(rows[0]);
  }

  // Code versions
  async getVersions(sessionId: string): Promise<CodeVersion[]> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`
      SELECT id, session_id, code, title, language, created_at
      FROM adgen_versions WHERE session_id = ${sessionId} ORDER BY created_at ASC
    `;
    return rows.map(rowToVersion);
  }

  async createVersion(data: { id: string; sessionId: string; code: string; title: string; language?: string }): Promise<CodeVersion> {
    await ensureTables();
    const sql = getSql()!;
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO adgen_versions (id, session_id, code, title, language, created_at)
      VALUES (${data.id}, ${data.sessionId}, ${data.code}, ${data.title}, ${data.language || "tsx"}, ${now})
      RETURNING id, session_id, code, title, language, created_at
    `;
    return rowToVersion(rows[0]);
  }

  async updateVersion(sessionId: string, versionId: string, data: { code: string }): Promise<CodeVersion | null> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`
      UPDATE adgen_versions SET code = ${data.code}
      WHERE id = ${versionId} AND session_id = ${sessionId}
      RETURNING id, session_id, code, title, language, created_at
    `;
    return rows[0] ? rowToVersion(rows[0]) : null;
  }

  // ─── User CRUD ──────────────────────────────────────────────

  async getUser(githubUsername: string): Promise<User | null> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`
      SELECT id, github_id, github_username, avatar_url, email, stripe_customer_id, plan, generation_count_today, generation_reset_date, created_at
      FROM adgen_users WHERE github_username = ${githubUsername}
    `;
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`
      SELECT id, github_id, github_username, avatar_url, email, stripe_customer_id, plan, generation_count_today, generation_reset_date, created_at
      FROM adgen_users WHERE id = ${id}
    `;
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | null> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`
      SELECT id, github_id, github_username, avatar_url, email, stripe_customer_id, plan, generation_count_today, generation_reset_date, created_at
      FROM adgen_users WHERE stripe_customer_id = ${customerId}
    `;
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async createUser(data: { id: string; githubId: string; githubUsername: string; avatarUrl: string; email: string }): Promise<User> {
    await ensureTables();
    const sql = getSql()!;
    const today = new Date().toISOString().split("T")[0];
    const rows = await sql`
      INSERT INTO adgen_users (id, github_id, github_username, avatar_url, email, generation_reset_date)
      VALUES (${data.id}, ${data.githubId}, ${data.githubUsername}, ${data.avatarUrl}, ${data.email}, ${today})
      ON CONFLICT (github_id) DO UPDATE SET github_username = ${data.githubUsername}, avatar_url = ${data.avatarUrl}
      RETURNING id, github_id, github_username, avatar_url, email, stripe_customer_id, plan, generation_count_today, generation_reset_date, created_at
    `;
    return rowToUser(rows[0]);
  }

  async updateUser(id: string, data: Partial<Pick<User, "stripeCustomerId" | "plan" | "generationCountToday" | "generationResetDate">>): Promise<User | null> {
    await ensureTables();
    const sql = getSql()!;
    if (data.stripeCustomerId !== undefined) await sql`UPDATE adgen_users SET stripe_customer_id = ${data.stripeCustomerId} WHERE id = ${id}`;
    if (data.plan !== undefined) await sql`UPDATE adgen_users SET plan = ${data.plan} WHERE id = ${id}`;
    if (data.generationCountToday !== undefined) await sql`UPDATE adgen_users SET generation_count_today = ${data.generationCountToday} WHERE id = ${id}`;
    if (data.generationResetDate !== undefined) await sql`UPDATE adgen_users SET generation_reset_date = ${data.generationResetDate} WHERE id = ${id}`;
    return this.getUserById(id);
  }

  async incrementGenerationCount(userId: string): Promise<number> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`
      UPDATE adgen_users SET generation_count_today = generation_count_today + 1
      WHERE id = ${userId}
      RETURNING generation_count_today
    `;
    return (rows[0]?.generation_count_today as number) ?? 0;
  }

  async resetGenerationCountIfNeeded(userId: string): Promise<void> {
    await ensureTables();
    const sql = getSql()!;
    const today = new Date().toISOString().split("T")[0];
    await sql`
      UPDATE adgen_users SET generation_count_today = 0, generation_reset_date = ${today}
      WHERE id = ${userId} AND generation_reset_date != ${today}
    `;
  }

  async getUserSessionCount(userId: string): Promise<number> {
    await ensureTables();
    const sql = getSql()!;
    const rows = await sql`SELECT COUNT(*) as count FROM adgen_sessions WHERE user_id = ${userId}`;
    return Number(rows[0]?.count ?? 0);
  }

  // GitHub — no-op stubs (GitHub tokens use encrypted cookies now)
  getGitHubToken(): GitHubToken | null { return null; }
  setGitHubToken(_token: GitHubToken): void {}
  clearGitHubToken(): void {}
}

// ─── Row Mappers ─────────────────────────────────────────────

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    title: row.title as string,
    starred: row.starred as boolean,
    model: row.model as string,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? (row.updated_at as string),
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as "user" | "assistant",
    content: row.content as string,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
  };
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    githubId: row.github_id as string,
    githubUsername: row.github_username as string,
    avatarUrl: (row.avatar_url as string) ?? "",
    email: (row.email as string) ?? "",
    stripeCustomerId: (row.stripe_customer_id as string) ?? null,
    plan: (row.plan as "free" | "pro") ?? "free",
    generationCountToday: (row.generation_count_today as number) ?? 0,
    generationResetDate: (row.generation_reset_date as string) ?? "",
    createdAt: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
  };
}

function rowToVersion(row: Record<string, unknown>): CodeVersion {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    code: row.code as string,
    title: row.title as string,
    language: row.language as string,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
  };
}

// ─── In-Memory Fallback ──────────────────────────────────────

class MemoryStorage {
  private sessions: Map<string, Session> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private versions: Map<string, CodeVersion[]> = new Map();
  private users: Map<string, User> = new Map();

  async getSessions(_userId?: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }
  async getSession(id: string): Promise<Session | undefined> { return this.sessions.get(id); }
  async createSession(data: { id: string; title?: string; model?: string }): Promise<Session> {
    const now = new Date().toISOString();
    const s: Session = { id: data.id, title: data.title || "New project", starred: false, model: data.model || "", createdAt: now, updatedAt: now };
    this.sessions.set(data.id, s);
    return s;
  }
  async updateSession(id: string, data: Partial<Session>): Promise<Session | null> {
    const s = this.sessions.get(id);
    if (!s) return null;
    const updated = { ...s, ...data, updatedAt: new Date().toISOString() };
    this.sessions.set(id, updated);
    return updated;
  }
  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id); this.messages.delete(id); this.versions.delete(id);
  }
  async getMessages(sessionId: string): Promise<Message[]> { return this.messages.get(sessionId) || []; }
  async createMessage(data: { id: string; sessionId: string; role: "user" | "assistant"; content: string }): Promise<Message> {
    const m: Message = { ...data, createdAt: new Date().toISOString() };
    const msgs = this.messages.get(data.sessionId) || [];
    msgs.push(m);
    this.messages.set(data.sessionId, msgs);
    return m;
  }
  async getVersions(sessionId: string): Promise<CodeVersion[]> { return this.versions.get(sessionId) || []; }
  async createVersion(data: { id: string; sessionId: string; code: string; title: string; language?: string }): Promise<CodeVersion> {
    const v: CodeVersion = { ...data, language: data.language || "tsx", createdAt: new Date().toISOString() };
    const vers = this.versions.get(data.sessionId) || [];
    vers.push(v);
    this.versions.set(data.sessionId, vers);
    return v;
  }
  async updateVersion(sessionId: string, versionId: string, data: { code: string }): Promise<CodeVersion | null> {
    const vers = this.versions.get(sessionId);
    if (!vers) return null;
    const idx = vers.findIndex((v) => v.id === versionId);
    if (idx === -1) return null;
    vers[idx] = { ...vers[idx], ...data };
    return vers[idx];
  }
  // User stubs for in-memory fallback
  async getUser(githubUsername: string): Promise<User | null> {
    return Array.from(this.users.values()).find((u) => u.githubUsername === githubUsername) ?? null;
  }
  async getUserById(id: string): Promise<User | null> { return this.users.get(id) ?? null; }
  async getUserByStripeCustomerId(customerId: string): Promise<User | null> {
    return Array.from(this.users.values()).find((u) => u.stripeCustomerId === customerId) ?? null;
  }
  async createUser(data: { id: string; githubId: string; githubUsername: string; avatarUrl: string; email: string }): Promise<User> {
    const u: User = { ...data, stripeCustomerId: null, plan: "free", generationCountToday: 0, generationResetDate: new Date().toISOString().split("T")[0], createdAt: new Date().toISOString() };
    this.users.set(data.id, u);
    return u;
  }
  async updateUser(id: string, data: Partial<Pick<User, "stripeCustomerId" | "plan" | "generationCountToday" | "generationResetDate">>): Promise<User | null> {
    const u = this.users.get(id);
    if (!u) return null;
    const updated = { ...u, ...data };
    this.users.set(id, updated);
    return updated;
  }
  async incrementGenerationCount(userId: string): Promise<number> {
    const u = this.users.get(userId);
    if (!u) return 0;
    u.generationCountToday++;
    return u.generationCountToday;
  }
  async resetGenerationCountIfNeeded(userId: string): Promise<void> {
    const u = this.users.get(userId);
    if (!u) return;
    const today = new Date().toISOString().split("T")[0];
    if (u.generationResetDate !== today) { u.generationCountToday = 0; u.generationResetDate = today; }
  }
  async getUserSessionCount(userId: string): Promise<number> {
    return Array.from(this.sessions.values()).filter(() => false).length; // Memory storage doesn't track user_id
  }

  getGitHubToken(): GitHubToken | null { return null; }
  setGitHubToken(_token: GitHubToken): void {}
  clearGitHubToken(): void {}
}

// ─── Export ──────────────────────────────────────────────────

export type StorageInterface = PostgresStorage | MemoryStorage;

export const storage: StorageInterface = process.env.DATABASE_URL
  ? new PostgresStorage()
  : new MemoryStorage();
