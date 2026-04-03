import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("adgenai_session")?.value

    // For public project access, we might allow viewing without auth
    // but for now require auth
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessions = await sql`SELECT user_id FROM auth_sessions WHERE token = ${sessionToken} AND expires_at > NOW()`
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const userId = sessions[0].user_id

    const projects = await sql`
      SELECT id, name, created_at, updated_at 
      FROM projects 
      WHERE id = ${id} AND user_id = ${userId}
    `
    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get messages for this project
    const messages = await sql`
      SELECT id, role, content, created_at 
      FROM messages 
      WHERE project_id = ${id} 
      ORDER BY created_at ASC
    `

    return NextResponse.json({
      ...projects[0],
      messages,
    })
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("adgenai_session")?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessions = await sql`SELECT user_id FROM auth_sessions WHERE token = ${sessionToken} AND expires_at > NOW()`
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const userId = sessions[0].user_id

    const body = await req.json()
    const { name } = body

    await sql`
      UPDATE projects 
      SET name = ${name}, updated_at = NOW() 
      WHERE id = ${id} AND user_id = ${userId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("adgenai_session")?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessions = await sql`SELECT user_id FROM auth_sessions WHERE token = ${sessionToken} AND expires_at > NOW()`
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const userId = sessions[0].user_id

    // Delete messages first, then project
    await sql`DELETE FROM messages WHERE project_id = ${id}`
    await sql`DELETE FROM projects WHERE id = ${id} AND user_id = ${userId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
