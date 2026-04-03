import { getMessages, upsertMessages } from "@/lib/db"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId")
    if (!sessionId) return Response.json({ messages: [] })
    const messages = await getMessages(sessionId)
    return Response.json({ messages })
  } catch (err) {
    console.error("[v0] GET /api/messages error:", err)
    return Response.json({ messages: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, messages } = await req.json()
    if (!sessionId || !Array.isArray(messages)) {
      return Response.json({ error: "Invalid body" }, { status: 400 })
    }
    await upsertMessages(sessionId, messages)
    return Response.json({ ok: true })
  } catch (err) {
    console.error("[v0] POST /api/messages error:", err)
    return Response.json({ error: "Failed to save messages" }, { status: 500 })
  }
}
