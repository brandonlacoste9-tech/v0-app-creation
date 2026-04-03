import { NextResponse } from "next/server"
import { getUserByEmail, verifyPassword, createSession, setSessionCookie } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const user = await getUserByEmail(email)
    if (!user || !user.password_hash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const token = await createSession(user.id)
    await setSessionCookie(token)

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (e) {
    console.error("[v0] login error", e)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
