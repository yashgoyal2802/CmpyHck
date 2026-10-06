import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Gate every protected route at the edge.
 *
 * Doing this in middleware rather than per-page means a new route is protected
 * by default: forgetting a session check in a page cannot silently expose it.
 * Role gating lives here for the same reason — see design.md (add-user-roles)
 * §Decision 3: one allowlist of what `search_only` can reach, rather than a
 * per-page/per-route check that a future route could forget to add.
 */

/** The only paths a search_only account may reach: the search page itself and its API. */
function isAllowedForSearchOnly(pathname: string): boolean {
  return pathname === "/" || pathname === "/api/briefs" || pathname.startsWith("/api/briefs/");
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token, process.env.AUTH_SECRET);
  const isApiRequest = request.nextUrl.pathname.startsWith("/api/");

  // A non-admin session with no API key is one of: a session minted before
  // this change (migration case), or a corrupted/undecryptable key segment.
  // Either way it cannot be used to generate a brief, so treat it exactly
  // like no session at all and force a real re-login where the key is
  // collected - see add-per-session-gemini-key design.md. A demo session is
  // the one deliberate exception: it's non-admin and legitimately never
  // carries a key, because it never calls a real provider at all - see
  // add-demo-mode design.md. This is a narrow, additive clause, not a
  // loosening of the rule above for any real (non-demo) session.
  const isUsableSession =
    session && (session.role === "admin" || session.apiKey !== undefined || session.isDemo);

  if (!isUsableSession) {
    // API callers get a status they can act on; page requests get the sign-in form.
    if (isApiRequest) {
      return NextResponse.json(
        { error: { kind: "unauthorized", message: "Sign in to continue." } },
        { status: 401 },
      );
    }
    const signInUrl = new URL("/signin", request.url);
    return NextResponse.redirect(signInUrl);
  }

  if (session.role === "search_only" && !isAllowedForSearchOnly(request.nextUrl.pathname)) {
    // The user *is* authenticated, just not permitted here — sending them to
    // /signin (as the unauthenticated case does) would be wrong; they're not
    // signed out, they're restricted.
    if (isApiRequest) {
      return NextResponse.json(
        { error: { kind: "forbidden", message: "Your account does not have access to this." } },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except the sign-in page and static assets.
  matcher: [
    "/",
    "/organizer",
    "/compare",
    "/saved",
    "/api/briefs/:path*",
    "/api/organizer/:path*",
    "/api/comparison/:path*",
  ],
};
