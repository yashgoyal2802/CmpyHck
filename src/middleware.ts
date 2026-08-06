import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Gate every protected route at the edge.
 *
 * Doing this in middleware rather than per-page means a new route is protected
 * by default: forgetting a session check in a page cannot silently expose it.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token, process.env.AUTH_SECRET);

  if (session) return NextResponse.next();

  // API callers get a status they can act on; page requests get the sign-in form.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { kind: "unauthorized", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const signInUrl = new URL("/signin", request.url);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  // Everything except the sign-in page and static assets.
  matcher: [
    "/",
    "/organizer",
    "/compare",
    "/api/briefs/:path*",
    "/api/organizer/:path*",
    "/api/comparison/:path*",
  ],
};
