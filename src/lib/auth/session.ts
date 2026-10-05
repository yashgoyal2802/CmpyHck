import type { AccountRole } from "@/lib/storage/types";

/**
 * Signed session tokens carrying an account identity.
 *
 * Extends the original shared-passphrase session (an expiry-only signed
 * cookie) with a username claim, so downstream code can scope data — the
 * personal organizer — to the account that is actually signed in. The cookie
 * mechanics, HMAC signing, and edge-compatibility are unchanged.
 *
 * Implemented on Web Crypto so it runs unchanged in Edge middleware. The
 * `AccountRole` import above is type-only and erased at compile time, so it
 * does not pull `postgres.ts`'s Node-only dependencies into this module.
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

const AES_IV_BYTES = 12;

/**
 * Key for encrypting a non-admin session's Gemini API key within the cookie.
 *
 * Derived from `AUTH_SECRET` via SHA-256 rather than a separate secret, so
 * this change doesn't add a second value to provision and rotate - the HMAC
 * signing key and this AES key are different derivations of the same trust
 * root, giving clean domain separation between the two uses.
 */
async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Base64url for raw bytes (IV/ciphertext) - distinct from `toBase64Url`/`fromBase64Url`, which are for unicode text via TextEncoder/Decoder and would corrupt arbitrary byte values. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Encrypt a session's Gemini API key for storage in the cookie: `<iv>:<ciphertext>`, both base64url. */
async function encryptApiKey(apiKey: string, secret: string): Promise<string> {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(apiKey));
  return `${bytesToBase64Url(iv)}:${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

/** Decrypt a session's Gemini API key segment. Returns null on any malformed or undecryptable input. */
async function decryptApiKey(segment: string, secret: string): Promise<string | null> {
  const separator = segment.indexOf(":");
  if (separator <= 0) return null;

  const iv = base64UrlToBytes(segment.slice(0, separator));
  const ciphertext = base64UrlToBytes(segment.slice(separator + 1));
  if (iv === null || ciphertext === null || iv.length !== AES_IV_BYTES) return null;

  try {
    const key = await aesKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
}

export interface SessionPayload {
  username: string;
  role: AccountRole;
  expiresAt: number;
  /** A non-admin session's own Gemini API key. Always absent for admin sessions. */
  apiKey?: string;
}

const VALID_ROLES: readonly AccountRole[] = ["admin", "standard", "search_only"];

/**
 * Payload is `<expiresAt>.<username(base64url)>.<role(base64url)>.<apiKey(encrypted)?>` —
 * each new segment is appended after the previous ones rather than replacing
 * the prior shape, so a token signed before this change (no role or apiKey
 * segment) still splits cleanly on `.` and falls through to the fail-open
 * defaults in decodePayload below. The apiKey segment is present only for
 * non-admin sessions.
 */
async function encodePayload(
  username: string,
  role: AccountRole,
  expiresAt: number,
  apiKey: string | undefined,
  secret: string,
): Promise<string> {
  const base = `${expiresAt}.${toBase64Url(username)}.${toBase64Url(role)}`;
  if (!apiKey) return base;
  return `${base}.${await encryptApiKey(apiKey, secret)}`;
}

async function decodePayload(payload: string, secret: string): Promise<SessionPayload | null> {
  const parts = payload.split(".");
  if (parts.length < 2) return null;

  const expiresAt = Number(parts[0]);
  if (!Number.isSafeInteger(expiresAt)) return null;

  const username = fromBase64Url(parts[1]);
  if (username === null || username.length === 0) return null;

  // A token signed before roles existed has no third segment. Fail open to
  // "standard" (this session's owner had full access a moment before this
  // change shipped), not closed to "search_only" — see design.md §Migration
  // Plan step 2. An unrecognized or corrupt role segment gets the same
  // fail-open treatment rather than invalidating an otherwise-valid,
  // correctly-signed token.
  let role: AccountRole = "standard";
  if (parts.length >= 3) {
    const decodedRole = fromBase64Url(parts[2]);
    if (decodedRole !== null && (VALID_ROLES as readonly string[]).includes(decodedRole)) {
      role = decodedRole as AccountRole;
    }
  }

  // A token with no 4th segment (admin session, or a non-admin session
  // signed before this change) simply has no key. A malformed/undecryptable
  // 4th segment is treated the same way rather than invalidating an
  // otherwise validly-signed token - see add-per-session-gemini-key
  // design.md.
  let apiKey: string | undefined;
  if (parts.length >= 4) {
    const decrypted = await decryptApiKey(parts[3], secret);
    if (decrypted !== null) apiKey = decrypted;
  }

  return apiKey !== undefined ? { username, role, expiresAt, apiKey } : { username, role, expiresAt };
}

/**
 * Mint a session token: `<expiry>.<username(base64url)>.<role(base64url)>.<apiKey?>.<hmac>`.
 *
 * Expiry, username, role, and (when present) the API key are all inside the
 * signed payload, so a client cannot extend its own session, swap
 * identities, escalate its role, or swap in another session's key by
 * editing the cookie — tampering with any of them invalidates the signature.
 */
export async function createSessionToken(
  secret: string,
  username: string,
  role: AccountRole,
  ttlSeconds: number = SESSION_TTL_SECONDS,
  now: number = Date.now(),
  apiKey?: string,
): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + ttlSeconds;
  const payload = await encodePayload(username, role, expiresAt, apiKey, secret);
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

  const decoded = await decodePayload(payload, secret);
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
