import { NextResponse } from "next/server"
import { createUser, getUserByEmail, createSession, setSessionCookie } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existing = await getUserByEmail(email)
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const user = await createUser(email, password, name)
    const token = await createSession(user.id)
    await setSessionCookie(token)

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (e) {
    console.error("[v0] register error", e)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
