import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ user: null }, { status: 401 })
    return NextResponse.json({ user })
  } catch (e) {
    console.error("[v0] session error", e)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
