import { describe, expect, it } from "vitest";
import { verifyCredentials } from "@/lib/auth/credentials";
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
      accounts: [{ username: "priya", passwordHash: await hashPassword("hunter2") }],
    });
    expect(await verifyCredentials("priya", "hunter2", storage)).toBe(true);
  });

  it("denies a provisioned account with the wrong password", async () => {
    const storage = createMemoryStorage({
      accounts: [{ username: "priya", passwordHash: await hashPassword("hunter2") }],
    });
    expect(await verifyCredentials("priya", "wrong", storage)).toBe(false);
  });

  it("denies an unknown username", async () => {
    const storage = createMemoryStorage({
      accounts: [{ username: "priya", passwordHash: await hashPassword("hunter2") }],
    });
    expect(await verifyCredentials("unknown", "hunter2", storage)).toBe(false);
  });

  it("denies all access when no accounts are provisioned", async () => {
    const storage = createMemoryStorage();
    expect(await verifyCredentials("anyone", "anything", storage)).toBe(false);
  });

  it("denies an empty submission", async () => {
    const storage = createMemoryStorage({
      accounts: [{ username: "priya", passwordHash: await hashPassword("hunter2") }],
    });
    expect(await verifyCredentials("", "hunter2", storage)).toBe(false);
    expect(await verifyCredentials("priya", "", storage)).toBe(false);
    expect(await verifyCredentials(undefined, undefined, storage)).toBe(false);
  });
});

describe("session tokens", () => {
  it("accepts a token it just minted and returns the account's username", async () => {
    const token = await createSessionToken(SECRET, "priya");
    expect(await verifySessionToken(token, SECRET)).toEqual({
      username: "priya",
      expiresAt: expect.any(Number),
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET, "priya");
    expect(await verifySessionToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered expiry, so a client cannot extend its own session", async () => {
    const now = Date.now();
    const token = await createSessionToken(SECRET, "priya", SESSION_TTL_SECONDS, now);
    const signature = token.slice(token.lastIndexOf(".") + 1);
    const usernameSegment = token.split(".")[1];
    const farFuture = Math.floor(now / 1000) + SESSION_TTL_SECONDS * 100;

    expect(
      await verifySessionToken(`${farFuture}.${usernameSegment}.${signature}`, SECRET),
    ).toBeNull();
  });

  it("rejects a tampered username, so a client cannot swap identities", async () => {
    const now = Date.now();
    const tokenA = await createSessionToken(SECRET, "priya", SESSION_TTL_SECONDS, now);
    const tokenB = await createSessionToken(SECRET, "yash", SESSION_TTL_SECONDS, now);
    const [expiresAtA] = tokenA.split(".");
    const [, usernameB] = tokenB.split(".");
    const signatureA = tokenA.slice(tokenA.lastIndexOf(".") + 1);

    // Splice yash's username claim into priya's otherwise-valid token.
    expect(
      await verifySessionToken(`${expiresAtA}.${usernameB}.${signatureA}`, SECRET),
    ).toBeNull();
  });

  it("rejects an expired token", async () => {
    const issuedAt = Date.now();
    const token = await createSessionToken(SECRET, "priya", 60, issuedAt);

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
    const token = await createSessionToken(SECRET, "priya");
    expect(await verifySessionToken(token, undefined)).toBeNull();
    expect(await verifySessionToken(token, "")).toBeNull();
  });
});

describe("configuration check", () => {
  it("requires the signing secret", () => {
    expect(isAuthConfigured({ AUTH_SECRET: "y" })).toBe(true);
    expect(isAuthConfigured({ AUTH_SECRET: "  " })).toBe(false);
    expect(isAuthConfigured({})).toBe(false);
  });
});
