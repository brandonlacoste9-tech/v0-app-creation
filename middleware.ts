import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/register", "/reset-password"]

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

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // If logged in and on an auth page, redirect home
  if (sessionToken && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // If not logged in and on a protected route, redirect to login
  if (!sessionToken && !isPublicPath) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)"],
}
