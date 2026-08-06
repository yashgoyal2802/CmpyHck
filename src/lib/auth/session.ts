/**
 * Shared-passphrase access control.
 *
 * This app is for one student and a handful of classmates who all know each
 * other. What it protects is the free-tier research quota, not personal data —
 * there is no user data to leak, because briefs are not persisted. A shared
 * secret is therefore the right-sized mechanism, and it avoids an OAuth client
 * whose only benefit (per-user identity) belongs to the deferred saved-briefs
 * feature.
 *
 * If saved briefs with personal notes are built later, identity starts earning
 * its setup cost and this module is the thing to replace.
 *
 * Implemented on Web Crypto so it runs unchanged in Edge middleware.
 */

export const SESSION_COOKIE = "pb_session";

/** Cookie lifetime. A placement season is weeks; a month avoids re-entry friction. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

/** Compare two byte arrays without leaking length or position via timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(digest);
}

/**
 * Check a submitted passphrase.
 *
 * Both sides are hashed first so the comparison is over fixed-length digests —
 * a direct string compare would leak the passphrase length and, on most
 * engines, its matching prefix.
 *
 * Fails closed: an unset or empty configured passphrase rejects everyone,
 * including the owner. A misconfigured deploy should lock the door, not remove it.
 */
export async function verifyPassphrase(
  submitted: string | undefined | null,
  configured: string | undefined | null,
): Promise<boolean> {
  if (!submitted || !configured) return false;
  if (configured.trim().length === 0) return false;

  const [a, b] = await Promise.all([sha256(submitted), sha256(configured)]);
  return timingSafeEqual(a, b);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

/**
 * Mint a session token: `<expiry>.<hmac>`.
 *
 * The expiry is inside the signed payload, so a client cannot extend its own
 * session by editing the cookie — tampering invalidates the signature.
 */
export async function createSessionToken(
  secret: string,
  ttlSeconds: number = SESSION_TTL_SECONDS,
  now: number = Date.now(),
): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + ttlSeconds;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string | undefined | null,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token || !secret) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const provided = fromHex(token.slice(separator + 1));
  if (!provided) return false;

  const expiresAt = Number(payload);
  if (!Number.isSafeInteger(expiresAt)) return false;

  // Verify the signature even when expired, so an expired token and a forged
  // one take the same code path and cost the same time.
  const expected = fromHex(await sign(payload, secret));
  if (!expected || !timingSafeEqual(provided, expected)) return false;

  return expiresAt * 1000 > now;
}

/** Loose env shape so callers and tests can pass a plain object. */
export type AuthEnv = Record<string, string | undefined>;

/** True when both the passphrase and the signing secret are configured. */
export function isAuthConfigured(env: AuthEnv): boolean {
  return Boolean(env.ACCESS_PASSPHRASE?.trim() && env.AUTH_SECRET?.trim());
}
