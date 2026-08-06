/**
 * Signed session tokens carrying an account identity.
 *
 * Extends the original shared-passphrase session (an expiry-only signed
 * cookie) with a username claim, so downstream code can scope data — the
 * personal organizer — to the account that is actually signed in. The cookie
 * mechanics, HMAC signing, and edge-compatibility are unchanged.
 *
 * Implemented on Web Crypto so it runs unchanged in Edge middleware.
 */

export const SESSION_COOKIE = "pb_session";

/** Cookie lifetime. A placement season is weeks; a month avoids re-entry friction. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Compare two byte arrays without leaking length or position via timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
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

/** Base64url, unicode-safe, using only Web APIs available in Edge middleware. */
function toBase64Url(value: string): string {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

export interface SessionPayload {
  username: string;
  expiresAt: number;
}

function encodePayload(username: string, expiresAt: number): string {
  return `${expiresAt}.${toBase64Url(username)}`;
}

function decodePayload(payload: string): SessionPayload | null {
  const separator = payload.indexOf(".");
  if (separator <= 0) return null;

  const expiresAt = Number(payload.slice(0, separator));
  if (!Number.isSafeInteger(expiresAt)) return null;

  const username = fromBase64Url(payload.slice(separator + 1));
  if (username === null || username.length === 0) return null;

  return { username, expiresAt };
}

/**
 * Mint a session token: `<expiry>.<username(base64url)>.<hmac>`.
 *
 * Both expiry and username are inside the signed payload, so a client cannot
 * extend its own session or swap identities by editing the cookie —
 * tampering with either invalidates the signature.
 */
export async function createSessionToken(
  secret: string,
  username: string,
  ttlSeconds: number = SESSION_TTL_SECONDS,
  now: number = Date.now(),
): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + ttlSeconds;
  const payload = encodePayload(username, expiresAt);
  return `${payload}.${await sign(payload, secret)}`;
}

/** Verify a session token, returning the account identity it carries or null. */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string | undefined | null,
  now: number = Date.now(),
): Promise<SessionPayload | null> {
  if (!token || !secret) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const provided = fromHex(token.slice(separator + 1));
  if (!provided) return null;

  const decoded = decodePayload(payload);
  if (!decoded) return null;

  // Verify the signature even when expired, so an expired token and a forged
  // one take the same code path and cost the same time.
  const expected = fromHex(await sign(payload, secret));
  if (!expected || !timingSafeEqual(provided, expected)) return null;

  if (decoded.expiresAt * 1000 <= now) return null;

  return decoded;
}

/** Loose env shape so callers and tests can pass a plain object. */
export type AuthEnv = Record<string, string | undefined>;

/** True when the session-signing secret is configured. Account existence is a storage concern. */
export function isAuthConfigured(env: AuthEnv): boolean {
  return Boolean(env.AUTH_SECRET?.trim());
}
