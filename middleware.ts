import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get("adgenai_session")?.value

  // Always pass through static files, API routes, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Root route: redirect based on auth state
  if (pathname === "/") {
    if (sessionToken) {
      return NextResponse.redirect(new URL("/dashboard-v2", request.url))
    } else {
      return NextResponse.redirect(new URL("/landing", request.url))
    }
  }

  // If logged in and on auth pages, redirect to dashboard
  if (
    sessionToken &&
    (pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/sign-in" ||
      pathname === "/sign-up")
  ) {
    return NextResponse.redirect(new URL("/dashboard-v2", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)"],
}

