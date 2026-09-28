import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = "bisu-six.vercel.app";

/**
 * No auth layer: the app is single-user and open. The middleware only
 * keeps one job — every Vercel deployment stays reachable forever at its
 * own immutable *.vercel.app URL, and a home-screen icon pointing at one
 * would serve a frozen old build eternally, so non-canonical vercel.app
 * hosts are bounced to production.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.endsWith(".vercel.app") && host !== CANONICAL_HOST) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.port = "";
    url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|json)$).*)"],
};
