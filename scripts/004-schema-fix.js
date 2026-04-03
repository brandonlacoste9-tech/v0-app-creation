import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function migrate() {
  console.log('Running schema fix migration...')

  // Ensure users table has all required columns (some may have been created without them)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      avatar_url TEXT,
      stripe_customer_id TEXT,
      plan_id TEXT NOT NULL DEFAULT 'free',
      plan_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // Add missing columns if they don't exist yet
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_id TEXT NOT NULL DEFAULT 'free'`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`
  console.log('users table columns verified')

  await sql`
    CREATE TABLE IF NOT EXISTS usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      generations_used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, month)
    )
  `
  console.log('usage table verified')

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled Project',
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT`
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`
  console.log('projects table verified')

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('messages table verified')

  console.log('Schema fix migration complete!')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
