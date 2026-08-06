import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  isAuthConfigured,
  verifyPassphrase,
  verifySessionToken,
} from "@/lib/auth/session";

const SECRET = "test-signing-secret";
const PASSPHRASE = "spjimr-placements-2026";

describe("access control (task 5.2)", () => {
  it("admits a holder of the correct passphrase", async () => {
    expect(await verifyPassphrase(PASSPHRASE, PASSPHRASE)).toBe(true);
  });

  it("denies a wrong passphrase", async () => {
    expect(await verifyPassphrase("wrong", PASSPHRASE)).toBe(false);
  });

  it("denies a near-miss rather than matching on a prefix", async () => {
    expect(await verifyPassphrase("spjimr-placements-202", PASSPHRASE)).toBe(false);
    expect(await verifyPassphrase(PASSPHRASE + "x", PASSPHRASE)).toBe(false);
  });

  it("is case- and whitespace-sensitive", async () => {
    expect(await verifyPassphrase(PASSPHRASE.toUpperCase(), PASSPHRASE)).toBe(false);
    expect(await verifyPassphrase(` ${PASSPHRASE} `, PASSPHRASE)).toBe(false);
  });

  it("denies an empty submission", async () => {
    expect(await verifyPassphrase("", PASSPHRASE)).toBe(false);
    expect(await verifyPassphrase(undefined, PASSPHRASE)).toBe(false);
    expect(await verifyPassphrase(null, PASSPHRASE)).toBe(false);
  });

  it("fails closed when no passphrase is configured", async () => {
    // A misconfigured deploy must lock everyone out, not admit everyone.
    expect(await verifyPassphrase("anything", undefined)).toBe(false);
    expect(await verifyPassphrase("anything", "")).toBe(false);
    expect(await verifyPassphrase("   ", "   ")).toBe(false);
  });
});

describe("session tokens", () => {
  it("accepts a token it just minted", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, SECRET)).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, "other-secret")).toBe(false);
  });

  it("rejects a tampered expiry, so a client cannot extend its own session", async () => {
    const now = Date.now();
    const token = await createSessionToken(SECRET, SESSION_TTL_SECONDS, now);
    const signature = token.slice(token.lastIndexOf(".") + 1);
    const farFuture = Math.floor(now / 1000) + SESSION_TTL_SECONDS * 100;

    expect(await verifySessionToken(`${farFuture}.${signature}`, SECRET)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const issuedAt = Date.now();
    const token = await createSessionToken(SECRET, 60, issuedAt);

    expect(await verifySessionToken(token, SECRET, issuedAt + 30_000)).toBe(true);
    expect(await verifySessionToken(token, SECRET, issuedAt + 61_000)).toBe(false);
  });

  it("rejects malformed and missing tokens", async () => {
    for (const token of ["", "garbage", "123", ".abc", "abc.", "123.zzzz"]) {
      expect(await verifySessionToken(token, SECRET)).toBe(false);
    }
    expect(await verifySessionToken(undefined, SECRET)).toBe(false);
    expect(await verifySessionToken(null, SECRET)).toBe(false);
  });

  it("rejects any token when no secret is configured", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, undefined)).toBe(false);
    expect(await verifySessionToken(token, "")).toBe(false);
  });
});

describe("configuration check", () => {
  it("requires both the passphrase and the signing secret", () => {
    expect(isAuthConfigured({ ACCESS_PASSPHRASE: "x", AUTH_SECRET: "y" })).toBe(true);
    expect(isAuthConfigured({ ACCESS_PASSPHRASE: "x" })).toBe(false);
    expect(isAuthConfigured({ AUTH_SECRET: "y" })).toBe(false);
    expect(isAuthConfigured({ ACCESS_PASSPHRASE: "  ", AUTH_SECRET: "y" })).toBe(false);
    expect(isAuthConfigured({})).toBe(false);
  });
});
