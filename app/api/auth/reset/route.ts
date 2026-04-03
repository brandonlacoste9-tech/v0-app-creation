import { NextResponse } from "next/server"
import { setResetToken, resetPassword } from "@/lib/auth"

// POST /api/auth/reset  — request a reset token (in prod: email the link)
// POST /api/auth/reset?action=confirm — confirm with token + new password
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get("action")
    const body = await req.json()

    if (action === "confirm") {
      const { token, password } = body
      if (!token || !password || password.length < 8) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 })
      }
      const ok = await resetPassword(token, password)
      if (!ok) return NextResponse.json({ error: "Token is invalid or expired" }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    // Request reset
    const { email } = body
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })
    const resetToken = await setResetToken(email)
    // In production send an email here. For now return token directly in dev.
    if (process.env.NODE_ENV === "development" && resetToken) {
      return NextResponse.json({ ok: true, resetToken })
    }
    // Always return ok to avoid email enumeration
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[v0] reset error", e)
    return NextResponse.json({ error: "Reset failed" }, { status: 500 })
  }
}
