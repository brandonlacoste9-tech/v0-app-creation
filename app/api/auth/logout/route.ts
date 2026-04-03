import { NextResponse } from "next/server"
import { getSessionTokenFromCookie, deleteSession, clearSessionCookie } from "@/lib/auth"

export async function POST() {
  try {
    const token = await getSessionTokenFromCookie()
    if (token) await deleteSession(token)
    await clearSessionCookie()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[v0] logout error", e)
    return NextResponse.json({ error: "Logout failed" }, { status: 500 })
  }
}
