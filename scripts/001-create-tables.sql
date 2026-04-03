-- adgenai: Neon database schema
-- Sessions table: stores each chat session
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'New chat',
  starred     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table: stores chat messages per session
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  parts       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Versions table: stores generated code versions per session
CREATE TABLE IF NOT EXISTS versions (
  id                   TEXT PRIMARY KEY,
  session_id           TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  code                 TEXT NOT NULL,
  version_index        INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track active version per session
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS active_version_index INTEGER NOT NULL DEFAULT 0;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id);
CREATE INDEX IF NOT EXISTS versions_session_id_idx ON versions(session_id);
CREATE INDEX IF NOT EXISTS sessions_updated_at_idx ON sessions(updated_at DESC);
