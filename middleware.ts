import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Public paths that don't require auth
const PUBLIC_PATHS = [
  "/",
  "/landing",
  "/login",
  "/register",
  "/reset-password",
  "/sign-in",
  "/sign-up",
  "/project",
]

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

  const isPublicPath = PUBLIC_PATHS.some((p) => 
    pathname === p || pathname.startsWith(p + "/")
  )

  // Root route: redirect based on auth state
  if (pathname === "/") {
    if (sessionToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    } else {
      return NextResponse.redirect(new URL("/landing", request.url))
    }
  }

  // If logged in and on auth pages, redirect to dashboard
  if (sessionToken && (pathname === "/login" || pathname === "/register" || pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // If not logged in and on a protected route (like /dashboard), redirect to login
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
