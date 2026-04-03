import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/register", "/reset-password"]
const API_AUTH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/reset"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get("adgenai_session")?.value

  // Allow public auth pages and API auth routes through
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    API_AUTH_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".")
  ) {
    // If logged in and hitting auth page, redirect home
    if (sessionToken && PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  // Protected routes — require session cookie
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)"],
}
