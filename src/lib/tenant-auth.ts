/**
 * Multi-tenant lockdown — PATs (CLI) + project ingest keys (telemetry).
 * Tokens stored as SHA-256 hashes only; plaintext shown once at creation.
 */
import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export type TenantId = string; // adgen_users.id

export interface PersonalAccessToken {
  id: string;
  userId: string;
  name: string;
  /** First 8 chars of raw token for UI identification */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ProjectIngestKey {
  id: string;
  userId: string;
  /** Studio session / project id */
  projectId: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AuthContext {
  tenantId: TenantId;
  /** When authenticated via PAT */
  patId?: string;
  /** When authenticated via ingest key */
  ingestKeyId?: string;
  projectId?: string;
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateRawToken(prefix: string): string {
  // sb_pat_… or sb_ing_…
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

let migrated = false;

export async function ensureTenantAuthTables(): Promise<void> {
  const sql = getSql();
  if (!sql || migrated) return;

  await sql`
    CREATE TABLE IF NOT EXISTS shipboard_pats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES adgen_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'CLI token',
      token_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_pats_user ON shipboard_pats(user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_pats_hash ON shipboard_pats(token_hash)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shipboard_ingest_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES adgen_users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Ingest key',
      key_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_ingest_user ON shipboard_ingest_keys(user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_ingest_project ON shipboard_ingest_keys(project_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_ingest_hash ON shipboard_ingest_keys(key_hash)
  `;

  // Telemetry: tenant + project columns (platform host DB only)
  await sql`
    CREATE TABLE IF NOT EXISTS shipboard_telemetry (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      tool TEXT NOT NULL,
      args JSONB,
      result_preview JSONB,
      error TEXT,
      latency_ms INTEGER,
      run_id TEXT,
      timestamp TIMESTAMPTZ NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      estimated_cost_usd DOUBLE PRECISION,
      model TEXT,
      meta JSONB,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tenant_id TEXT,
      project_id TEXT
    )
  `;
  await sql`
    DO $$ BEGIN
      ALTER TABLE shipboard_telemetry ADD COLUMN IF NOT EXISTS tenant_id TEXT;
      ALTER TABLE shipboard_telemetry ADD COLUMN IF NOT EXISTS project_id TEXT;
    EXCEPTION WHEN others THEN NULL;
    END $$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_telemetry_tenant
    ON shipboard_telemetry(tenant_id, received_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_shipboard_telemetry_project
    ON shipboard_telemetry(project_id, received_at DESC)
  `;

  // App-level RLS helper: policies deny by default when FORCE RLS + no bypass.
  // Neon service role often bypasses RLS; we still enable policies as defense-in-depth
  // for non-superuser roles and document SET app.tenant_id for future role split.
  try {
    await sql`ALTER TABLE shipboard_telemetry ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE shipboard_pats ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE shipboard_ingest_keys ENABLE ROW LEVEL SECURITY`;
    // Drop/recreate idempotent policies (no auth.uid() — we use request setting)
    await sql`DROP POLICY IF EXISTS shipboard_telemetry_tenant_isolation ON shipboard_telemetry`;
    await sql`
      CREATE POLICY shipboard_telemetry_tenant_isolation ON shipboard_telemetry
      FOR ALL
      USING (
        tenant_id IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
      )
      WITH CHECK (
        tenant_id IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
      )
    `;
  } catch {
    // RLS may fail without ownership — app-level scoping remains mandatory
  }

  migrated = true;
}

// ─── In-memory fallback ───────────────────────────────────────

const memPats = new Map<
  string,
  PersonalAccessToken & { tokenHash: string }
>();
const memIngest = new Map<
  string,
  ProjectIngestKey & { keyHash: string }
>();

// ─── PAT CRUD ─────────────────────────────────────────────────

export async function createPat(
  userId: string,
  name = "CLI token"
): Promise<{ token: PersonalAccessToken; raw: string }> {
  await ensureTenantAuthTables();
  const raw = generateRawToken("sb_pat");
  const tokenHash = hashToken(raw);
  const prefix = raw.slice(0, 12);
  const id = randomBytes(16).toString("hex");
  const createdAt = new Date().toISOString();
  const record: PersonalAccessToken = {
    id,
    userId,
    name: name.slice(0, 80) || "CLI token",
    prefix,
    createdAt,
    lastUsedAt: null,
    revokedAt: null,
  };

  const sql = getSql();
  if (sql) {
    await sql`
      INSERT INTO shipboard_pats (id, user_id, name, token_hash, prefix, created_at)
      VALUES (${id}, ${userId}, ${record.name}, ${tokenHash}, ${prefix}, ${createdAt})
    `;
  } else {
    memPats.set(id, { ...record, tokenHash });
  }

  return { token: record, raw };
}

export async function listPats(userId: string): Promise<PersonalAccessToken[]> {
  await ensureTenantAuthTables();
  const sql = getSql();
  if (sql) {
    const rows = await sql`
      SELECT id, user_id, name, prefix, created_at, last_used_at, revoked_at
      FROM shipboard_pats
      WHERE user_id = ${userId} AND revoked_at IS NULL
      ORDER BY created_at DESC
    `;
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      userId: String(r.user_id),
      name: String(r.name),
      prefix: String(r.prefix),
      createdAt: String(r.created_at),
      lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
      revokedAt: r.revoked_at ? String(r.revoked_at) : null,
    }));
  }
  return [...memPats.values()]
    .filter((t) => t.userId === userId && !t.revokedAt)
    .map(({ tokenHash: _hash, ...t }) => {
      void _hash;
      return t;
    });
}

export async function revokePat(userId: string, patId: string): Promise<boolean> {
  await ensureTenantAuthTables();
  const sql = getSql();
  const now = new Date().toISOString();
  if (sql) {
    const rows = await sql`
      UPDATE shipboard_pats
      SET revoked_at = ${now}
      WHERE id = ${patId} AND user_id = ${userId} AND revoked_at IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  }
  const t = memPats.get(patId);
  if (!t || t.userId !== userId || t.revokedAt) return false;
  t.revokedAt = now;
  return true;
}

export async function resolvePat(raw: string): Promise<AuthContext | null> {
  if (!raw?.startsWith("sb_pat_")) return null;
  await ensureTenantAuthTables();
  const tokenHash = hashToken(raw);
  const sql = getSql();
  const now = new Date().toISOString();

  if (sql) {
    const rows = await sql`
      SELECT id, user_id FROM shipboard_pats
      WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
      LIMIT 1
    `;
    if (!rows[0]) return null;
    await sql`
      UPDATE shipboard_pats SET last_used_at = ${now} WHERE id = ${rows[0].id}
    `;
    return {
      tenantId: String(rows[0].user_id),
      patId: String(rows[0].id),
    };
  }

  for (const t of memPats.values()) {
    if (t.tokenHash === tokenHash && !t.revokedAt) {
      t.lastUsedAt = now;
      return { tenantId: t.userId, patId: t.id };
    }
  }
  return null;
}

// ─── Ingest keys ──────────────────────────────────────────────

export async function createIngestKey(
  userId: string,
  projectId: string,
  name = "Ingest key"
): Promise<{ key: ProjectIngestKey; raw: string }> {
  await ensureTenantAuthTables();
  const raw = generateRawToken("sb_ing");
  const keyHash = hashToken(raw);
  const prefix = raw.slice(0, 12);
  const id = randomBytes(16).toString("hex");
  const createdAt = new Date().toISOString();
  const record: ProjectIngestKey = {
    id,
    userId,
    projectId,
    name: name.slice(0, 80) || "Ingest key",
    prefix,
    createdAt,
    lastUsedAt: null,
    revokedAt: null,
  };

  const sql = getSql();
  if (sql) {
    await sql`
      INSERT INTO shipboard_ingest_keys
        (id, user_id, project_id, name, key_hash, prefix, created_at)
      VALUES (
        ${id}, ${userId}, ${projectId}, ${record.name},
        ${keyHash}, ${prefix}, ${createdAt}
      )
    `;
  } else {
    memIngest.set(id, { ...record, keyHash });
  }

  return { key: record, raw };
}

export async function listIngestKeys(
  userId: string,
  projectId?: string
): Promise<ProjectIngestKey[]> {
  await ensureTenantAuthTables();
  const sql = getSql();
  if (sql) {
    const rows = projectId
      ? await sql`
          SELECT id, user_id, project_id, name, prefix, created_at, last_used_at, revoked_at
          FROM shipboard_ingest_keys
          WHERE user_id = ${userId} AND project_id = ${projectId} AND revoked_at IS NULL
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT id, user_id, project_id, name, prefix, created_at, last_used_at, revoked_at
          FROM shipboard_ingest_keys
          WHERE user_id = ${userId} AND revoked_at IS NULL
          ORDER BY created_at DESC
        `;
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      userId: String(r.user_id),
      projectId: String(r.project_id),
      name: String(r.name),
      prefix: String(r.prefix),
      createdAt: String(r.created_at),
      lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
      revokedAt: r.revoked_at ? String(r.revoked_at) : null,
    }));
  }
  return [...memIngest.values()]
    .filter(
      (k) =>
        k.userId === userId &&
        !k.revokedAt &&
        (!projectId || k.projectId === projectId)
    )
    .map(({ keyHash: _hash, ...k }) => {
      void _hash;
      return k;
    });
}

export async function revokeIngestKey(
  userId: string,
  keyId: string
): Promise<boolean> {
  await ensureTenantAuthTables();
  const now = new Date().toISOString();
  const sql = getSql();
  if (sql) {
    const rows = await sql`
      UPDATE shipboard_ingest_keys
      SET revoked_at = ${now}
      WHERE id = ${keyId} AND user_id = ${userId} AND revoked_at IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  }
  const k = memIngest.get(keyId);
  if (!k || k.userId !== userId || k.revokedAt) return false;
  k.revokedAt = now;
  return true;
}

export async function resolveIngestKey(
  raw: string
): Promise<AuthContext | null> {
  if (!raw?.startsWith("sb_ing_")) return null;
  await ensureTenantAuthTables();
  const keyHash = hashToken(raw);
  const now = new Date().toISOString();
  const sql = getSql();

  if (sql) {
    const rows = await sql`
      SELECT id, user_id, project_id FROM shipboard_ingest_keys
      WHERE key_hash = ${keyHash} AND revoked_at IS NULL
      LIMIT 1
    `;
    if (!rows[0]) return null;
    await sql`
      UPDATE shipboard_ingest_keys SET last_used_at = ${now}
      WHERE id = ${rows[0].id}
    `;
    return {
      tenantId: String(rows[0].user_id),
      ingestKeyId: String(rows[0].id),
      projectId: String(rows[0].project_id),
    };
  }

  for (const k of memIngest.values()) {
    if (k.keyHash === keyHash && !k.revokedAt) {
      k.lastUsedAt = now;
      return {
        tenantId: k.userId,
        ingestKeyId: k.id,
        projectId: k.projectId,
      };
    }
  }
  return null;
}

/** Session must belong to tenant (or be unowned legacy → deny for secure APIs). */
export async function sessionBelongsToTenant(
  sessionId: string,
  tenantId: string
): Promise<boolean> {
  const sql = getSql();
  if (sql) {
    const rows = await sql`
      SELECT id FROM adgen_sessions
      WHERE id = ${sessionId} AND user_id = ${tenantId}
      LIMIT 1
    `;
    return rows.length > 0;
  }
  // Memory storage: no user scoping historically — allow if session exists
  try {
    const { storage } = await import("./storage");
    const s = await storage.getSession(sessionId);
    return Boolean(s);
  } catch {
    return false;
  }
}

export function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

export function extractTokenFromRequest(req: Request, url?: URL): string | null {
  const bearer = extractBearer(req);
  if (bearer) return bearer;
  const u = url || new URL(req.url);
  const q = u.searchParams.get("token");
  return q?.trim() || null;
}
