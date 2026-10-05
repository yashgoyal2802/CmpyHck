import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import type { AccountRole } from "@/lib/storage/types";

const SECRET = "test-signing-secret";
const ORIGIN = "http://localhost:3000";

/**
 * Builds a request with a session cookie. Non-admin roles get a dummy API
 * key by default, since a keyless non-admin session is now treated as
 * unauthenticated - pass `apiKey: null` to opt out and exercise that case.
 */
async function requestWithSession(
  path: string,
  role: AccountRole | null,
  options?: { apiKey?: string | null },
) {
  const request = new NextRequest(new URL(path, ORIGIN));
  if (role) {
    const apiKey =
      options && "apiKey" in options
        ? (options.apiKey ?? undefined)
        : role === "admin"
          ? undefined
          : "dummy-gemini-key";
    const token = await createSessionToken(SECRET, "priya", role, undefined, undefined, apiKey);
    request.cookies.set(SESSION_COOKIE, token);
  }
  const originalSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = SECRET;
  try {
    return await middleware(request);
  } finally {
    process.env.AUTH_SECRET = originalSecret;
  }
}

describe("middleware role gating (add-user-roles task 6.1)", () => {
  it("redirects an unauthenticated page request to /signin", async () => {
    const response = await requestWithSession("/organizer", null);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/signin");
  });

  it("returns 401 for an unauthenticated API request", async () => {
    const response = await requestWithSession("/api/organizer", null);
    expect(response.status).toBe(401);
  });

  for (const role of ["admin", "standard"] as const) {
    it(`lets a ${role} account reach every gated page`, async () => {
      for (const path of ["/", "/organizer", "/compare", "/saved"]) {
        const response = await requestWithSession(path, role);
        expect(response.status).not.toBe(307);
        expect(response.status).not.toBe(403);
      }
    });
  }

  it("lets a search_only account reach the search page", async () => {
    const response = await requestWithSession("/", "search_only");
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(403);
  });

  it("lets a search_only account use the briefs API", async () => {
    const response = await requestWithSession("/api/briefs/anything", "search_only");
    expect(response.status).not.toBe(403);
  });

  it("lets a search_only account hit the briefs API with no trailing path segment", async () => {
    const response = await requestWithSession("/api/briefs", "search_only");
    expect(response.status).not.toBe(403);
  });

  for (const path of ["/organizer", "/compare", "/saved"]) {
    it(`redirects a search_only account away from ${path} rather than to /signin`, async () => {
      const response = await requestWithSession(path, "search_only");
      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).not.toContain("/signin");
      expect(new URL(location!).pathname).toBe("/");
    });
  }

  for (const path of ["/api/organizer", "/api/comparison"]) {
    it(`denies a search_only account's ${path} request with 403, not 401`, async () => {
      const response = await requestWithSession(path, "search_only");
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.kind).toBe("forbidden");
    });
  }
});

describe("middleware session-key gating (add-per-session-gemini-key task 3.2)", () => {
  for (const role of ["standard", "search_only"] as const) {
    it(`treats a keyless ${role} session as unauthenticated on a page request`, async () => {
      const response = await requestWithSession("/", role, { apiKey: null });
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/signin");
    });

    it(`treats a keyless ${role} session as unauthenticated on an API request`, async () => {
      const response = await requestWithSession("/api/briefs", role, { apiKey: null });
      expect(response.status).toBe(401);
    });

    it(`lets a ${role} session with a key proceed as usual`, async () => {
      const response = await requestWithSession("/", role, { apiKey: "a-real-key" });
      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    });
  }

  it("an admin session with no key is unaffected", async () => {
    const response = await requestWithSession("/", "admin", { apiKey: null });
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(401);
  });
});
