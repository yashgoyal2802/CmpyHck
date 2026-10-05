import { describe, expect, it } from "vitest";
import { accountRequiresApiKey, verifyCredentials } from "@/lib/auth/credentials";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  isAuthConfigured,
  verifySessionToken,
} from "@/lib/auth/session";
import { createMemoryStorage } from "@/lib/storage/memory";

const SECRET = "test-signing-secret";

describe("password hashing", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("never stores the password in plain text", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
  });

  it("salts hashes, so the same password hashes differently each time", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });

  it("fails closed on a missing or malformed stored hash", async () => {
    expect(await verifyPassword("anything", undefined)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });
});

describe("credential verification (task 5.2/5.3)", () => {
  it("admits a provisioned account with the correct password", async () => {
    const storage = createMemoryStorage({
      accounts: [{ username: "priya", passwordHash: await hashPassword("hunter2"), role: "standard" }],
    });
    expect(await verifyCredentials("priya", "hunter2", storage)).toBe(true);
  });

  it("denies a provisioned account with the wrong password", async () => {
    const storage = createMemoryStorage({
      accounts: [{ username: "priya", passwordHash: await hashPassword("hunter2"), role: "standard" }],
    });
    expect(await verifyCredentials("priya", "wrong", storage)).toBe(false);
  });

  it("denies an unknown username", async () => {
    const storage = createMemoryStorage({
      accounts: [{ username: "priya", passwordHash: await hashPassword("hunter2"), role: "standard" }],
    });
    expect(await verifyCredentials("unknown", "hunter2", storage)).toBe(false);
  });

  it("denies all access when no accounts are provisioned", async () => {
    const storage = createMemoryStorage();
    expect(await verifyCredentials("anyone", "anything", storage)).toBe(false);
  });

  it("denies an empty submission", async () => {
    const storage = createMemoryStorage({
      accounts: [{ username: "priya", passwordHash: await hashPassword("hunter2"), role: "standard" }],
    });
    expect(await verifyCredentials("", "hunter2", storage)).toBe(false);
    expect(await verifyCredentials("priya", "", storage)).toBe(false);
    expect(await verifyCredentials(undefined, undefined, storage)).toBe(false);
  });
});

describe("Gemini API key requirement by role (add-per-session-gemini-key task 6.1/6.2)", () => {
  it("requires a key for standard and search_only accounts", () => {
    expect(accountRequiresApiKey("standard")).toBe(true);
    expect(accountRequiresApiKey("search_only")).toBe(true);
  });

  it("does not require a key for the admin account", () => {
    expect(accountRequiresApiKey("admin")).toBe(false);
  });
});

describe("session tokens", () => {
  it("accepts a token it just minted and returns the account's username and role", async () => {
    const token = await createSessionToken(SECRET, "priya", "standard");
    expect(await verifySessionToken(token, SECRET)).toEqual({
      username: "priya",
      role: "standard",
      expiresAt: expect.any(Number),
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET, "priya", "standard");
    expect(await verifySessionToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered expiry, so a client cannot extend its own session", async () => {
    const now = Date.now();
    const token = await createSessionToken(SECRET, "priya", "standard", SESSION_TTL_SECONDS, now);
    const signature = token.slice(token.lastIndexOf(".") + 1);
    const [, usernameSegment, roleSegment] = token.split(".");
    const farFuture = Math.floor(now / 1000) + SESSION_TTL_SECONDS * 100;

    expect(
      await verifySessionToken(`${farFuture}.${usernameSegment}.${roleSegment}.${signature}`, SECRET),
    ).toBeNull();
  });

  it("rejects a tampered username, so a client cannot swap identities", async () => {
    const now = Date.now();
    const tokenA = await createSessionToken(SECRET, "priya", "standard", SESSION_TTL_SECONDS, now);
    const tokenB = await createSessionToken(SECRET, "yash", "standard", SESSION_TTL_SECONDS, now);
    const [expiresAtA, , roleA] = tokenA.split(".");
    const [, usernameB] = tokenB.split(".");
    const signatureA = tokenA.slice(tokenA.lastIndexOf(".") + 1);

    // Splice yash's username claim into priya's otherwise-valid token.
    expect(
      await verifySessionToken(`${expiresAtA}.${usernameB}.${roleA}.${signatureA}`, SECRET),
    ).toBeNull();
  });

  it("rejects a tampered role, so a client cannot escalate its own access", async () => {
    const now = Date.now();
    const token = await createSessionToken(SECRET, "priya", "search_only", SESSION_TTL_SECONDS, now);
    const [expiresAt, usernameSegment] = token.split(".");
    const signature = token.slice(token.lastIndexOf(".") + 1);
    const corruptedRoleSegment = token.split(".")[2].replace(/./, "x");

    expect(
      await verifySessionToken(`${expiresAt}.${usernameSegment}.${corruptedRoleSegment}.${signature}`, SECRET),
    ).toBeNull();
  });

  it("rejects an expired token", async () => {
    const issuedAt = Date.now();
    const token = await createSessionToken(SECRET, "priya", "standard", 60, issuedAt);

    expect(await verifySessionToken(token, SECRET, issuedAt + 30_000)).not.toBeNull();
    expect(await verifySessionToken(token, SECRET, issuedAt + 61_000)).toBeNull();
  });

  it("rejects malformed and missing tokens", async () => {
    for (const token of ["", "garbage", "123", ".abc", "abc.", "123.zzzz", "123.abc.zzzz"]) {
      expect(await verifySessionToken(token, SECRET)).toBeNull();
    }
    expect(await verifySessionToken(undefined, SECRET)).toBeNull();
    expect(await verifySessionToken(null, SECRET)).toBeNull();
  });

  it("rejects any token when no secret is configured", async () => {
    const token = await createSessionToken(SECRET, "priya", "standard");
    expect(await verifySessionToken(token, undefined)).toBeNull();
    expect(await verifySessionToken(token, "")).toBeNull();
  });

  it("carries a non-admin session's Gemini API key through a round trip", async () => {
    const token = await createSessionToken(
      SECRET,
      "priya",
      "standard",
      SESSION_TTL_SECONDS,
      Date.now(),
      "my-gemini-key",
    );
    expect(await verifySessionToken(token, SECRET)).toEqual({
      username: "priya",
      role: "standard",
      expiresAt: expect.any(Number),
      apiKey: "my-gemini-key",
    });
  });

  it("omits the key segment when createSessionToken is called with no key (the admin path via startSession)", async () => {
    const token = await createSessionToken(SECRET, "owner", "admin");
    // expiresAt, username, role, hmac - no 4th (key) segment.
    expect(token.split(".")).toHaveLength(4);
  });

  it("rejects a tampered API key segment, so a client cannot swap in another session's key", async () => {
    const now = Date.now();
    const tokenA = await createSessionToken(SECRET, "priya", "standard", SESSION_TTL_SECONDS, now, "key-a");
    const tokenB = await createSessionToken(SECRET, "priya", "standard", SESSION_TTL_SECONDS, now, "key-b");
    const [expiresAt, username, role] = tokenA.split(".");
    const [, , , apiKeySegmentB] = tokenB.split(".");
    const signatureA = tokenA.slice(tokenA.lastIndexOf(".") + 1);

    // Splice session B's encrypted key into session A's otherwise-valid token.
    expect(
      await verifySessionToken(`${expiresAt}.${username}.${role}.${apiKeySegmentB}.${signatureA}`, SECRET),
    ).toBeNull();
  });

  it("decodes a pre-this-change non-admin token (no key segment) with no apiKey, rather than failing", async () => {
    // Simulates a session signed before this change: 3 segments, no key.
    const token = await createSessionToken(SECRET, "priya", "standard");
    expect(token.split(".")).toHaveLength(4); // expiresAt, username, role, hmac
    const decoded = await verifySessionToken(token, SECRET);
    expect(decoded?.apiKey).toBeUndefined();
  });

  it("two sessions for the same account each decode to their own independently-submitted key", async () => {
    const now = Date.now();
    const tokenA = await createSessionToken(SECRET, "test1", "standard", SESSION_TTL_SECONDS, now, "alice-key");
    const tokenB = await createSessionToken(SECRET, "test1", "standard", SESSION_TTL_SECONDS, now, "bob-key");

    expect((await verifySessionToken(tokenA, SECRET))?.apiKey).toBe("alice-key");
    expect((await verifySessionToken(tokenB, SECRET))?.apiKey).toBe("bob-key");
  });

  it("treats a pre-roles token (no role segment) as standard rather than rejecting it", async () => {
    // Simulates a session signed before this change: payload has only
    // <expiresAt>.<username>, no role segment.
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const legacyPayload = `${expiresAt}.${Buffer.from("priya").toString("base64url")}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureBytes = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(legacyPayload)),
    );
    const signatureHex = Array.from(signatureBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const legacyToken = `${legacyPayload}.${signatureHex}`;

    expect(await verifySessionToken(legacyToken, SECRET)).toEqual({
      username: "priya",
      role: "standard",
      expiresAt,
    });
  });
});

describe("configuration check", () => {
  it("requires the signing secret", () => {
    expect(isAuthConfigured({ AUTH_SECRET: "y" })).toBe(true);
    expect(isAuthConfigured({ AUTH_SECRET: "  " })).toBe(false);
    expect(isAuthConfigured({})).toBe(false);
  });
});
