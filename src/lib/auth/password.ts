import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing, node:crypto scrypt.
 *
 * Only used server-side in the sign-in Server Action and the owner
 * provisioning script — never in Edge middleware, so a Node-only API is fine
 * here (unlike `session.ts`, which must stay Web Crypto).
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SCHEME = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEY_BYTES);
  return `${SCHEME}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/**
 * Check a submitted password against a stored hash.
 *
 * Fails closed on any malformed input (missing hash, wrong scheme, bad hex)
 * rather than throwing, so a corrupt or absent account record behaves the
 * same as a wrong password.
 */
export async function verifyPassword(
  password: string,
  stored: string | undefined | null,
): Promise<boolean> {
  if (!stored) return false;

  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== SCHEME || !saltHex || !hashHex) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scrypt(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
