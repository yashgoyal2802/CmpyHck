import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";

const SECRET = "test-signing-secret";

/**
 * Route handlers read the session via `next/headers`'s `cookies()`, which
 * relies on Next's request-context and isn't available when a test imports
 * and calls the exported handler function directly - no existing test in
 * this codebase does that for a route handler. Mocking `next/headers` here
 * (not `verifySessionToken`, which runs for real against a genuinely
 * minted token) gets real coverage of the actual rejection branch in
 * src/app/api/organizer/route.ts and comparison/route.ts, rather than
 * re-testing the same `if (session.isDemo)` logic in isolation.
 */
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

async function mockDemoCookie() {
  const { cookies } = await import("next/headers");
  const token = await createSessionToken(SECRET, "__demo__", "standard", undefined, undefined, undefined, true);
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === SESSION_COOKIE ? { value: token } : undefined),
    // Only `get` is used by getSessionAccount().
  } as never);
}

describe("demo sessions are rejected by write-capable API routes (add-demo-mode task 6.4)", () => {
  const originalSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.AUTH_SECRET = originalSecret;
    vi.resetModules();
  });

  it("GET /api/organizer returns the frozen demo pipeline, not a real storage read", async () => {
    await mockDemoCookie();
    const { GET } = await import("@/app/api/organizer/route");

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries.length).toBeGreaterThan(1);
    const acme = body.entries.find((e: { resolvedName: string }) => e.resolvedName === "Acme Consulting");
    expect(acme.bookmarked).toBe(true);
    expect(body.entries.filter((e: { bookmarked: boolean }) => e.bookmarked)).toHaveLength(1);
  });

  it("POST /api/organizer rejects a demo session with 403", async () => {
    await mockDemoCookie();
    const { POST } = await import("@/app/api/organizer/route");

    const response = await POST(
      new Request("http://localhost/api/organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyKey: "evil-co",
          resolvedName: "Evil Co",
          status: "tracking",
          bookmarked: true,
        }),
      }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.kind).toBe("forbidden");
  });

  it("DELETE /api/organizer rejects a demo session with 403", async () => {
    await mockDemoCookie();
    const { DELETE } = await import("@/app/api/organizer/route");

    const response = await DELETE(new Request("http://localhost/api/organizer?companyKey=acme-consulting"));
    expect(response.status).toBe(403);
  });

  it("POST /api/comparison rejects a demo session with 403", async () => {
    await mockDemoCookie();
    const { POST } = await import("@/app/api/comparison/route");

    const response = await POST(
      new Request("http://localhost/api/comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: ["Acme Consulting", "Northwind Foods"] }),
      }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.kind).toBe("forbidden");
  });
});
