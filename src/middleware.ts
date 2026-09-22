import { NextResponse, type NextRequest } from "next/server";

/** One studio. Alias hosts 308 to shipboard.ca — deploy previews are left alone. */
const CANONICAL_HOST = "shipboard.ca";
const ALIAS_HOSTS = new Set(["shipboard.netlify.app", "www.shipboard.ca"]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0]?.toLowerCase();
  if (!host || !ALIAS_HOSTS.has(host)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
