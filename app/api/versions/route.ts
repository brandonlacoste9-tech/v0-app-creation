import { getVersions, createVersion } from "@/lib/db"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId")
    if (!sessionId) return Response.json({ versions: [] })
    const versions = await getVersions(sessionId)
    return Response.json({ versions })
  } catch (err) {
    console.error("[v0] GET /api/versions error:", err)
    return Response.json({ versions: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, version } = await req.json()
    if (!sessionId || !version) {
      return Response.json({ error: "Invalid body" }, { status: 400 })
    }
    await createVersion({ ...version, session_id: sessionId })
    return Response.json({ ok: true })
  } catch (err) {
    console.error("[v0] POST /api/versions error:", err)
    return Response.json({ error: "Failed to save version" }, { status: 500 })
  }
}
