import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("adgenai_session")?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from session
    const sessions = await sql`SELECT user_id FROM auth_sessions WHERE token = ${sessionToken} AND expires_at > NOW()`
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const userId = sessions[0].user_id

    const projects = await sql`
      SELECT id, name, created_at, updated_at 
      FROM projects 
      WHERE user_id = ${userId} 
      ORDER BY updated_at DESC
    `
    return NextResponse.json(projects)
  } catch (error) {
    console.error("GET /api/projects error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("adgenai_session")?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from session
    const sessions = await sql`SELECT user_id FROM auth_sessions WHERE token = ${sessionToken} AND expires_at > NOW()`
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const userId = sessions[0].user_id

    const body = await req.json().catch(() => ({}))
    const name = body.name || "Untitled Project"
    const id = crypto.randomUUID()

    await sql`
      INSERT INTO projects (id, user_id, name, created_at, updated_at)
      VALUES (${id}, ${userId}, ${name}, NOW(), NOW())
    `

    return NextResponse.json({ id, name })
  } catch (error) {
    console.error("POST /api/projects error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
