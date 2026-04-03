import { getSessions, createSession, updateSession, deleteSession } from "@/lib/db"
import { NextRequest } from "next/server"

export async function GET() {
  try {
    const sessions = await getSessions()
    return Response.json({ sessions })
  } catch (err) {
    console.error("[v0] GET /api/sessions error:", err)
    return Response.json({ sessions: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, title } = await req.json()
    await createSession(id, title ?? "New chat")
    return Response.json({ ok: true })
  } catch (err) {
    console.error("[v0] POST /api/sessions error:", err)
    return Response.json({ error: "Failed to create session" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, title, starred } = await req.json()
    await updateSession(id, title, starred)
    return Response.json({ ok: true })
  } catch (err) {
    console.error("[v0] PATCH /api/sessions error:", err)
    return Response.json({ error: "Failed to update session" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await deleteSession(id)
    return Response.json({ ok: true })
  } catch (err) {
    console.error("[v0] DELETE /api/sessions error:", err)
    return Response.json({ error: "Failed to delete session" }, { status: 500 })
  }
}
