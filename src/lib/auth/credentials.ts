import type { Storage } from "@/lib/storage";
import type { AccountRole } from "@/lib/storage/types";
import { verifyPassword } from "./password";

/**
 * A precomputed scrypt hash of a random value, never any real password's.
 * Used to run the same expensive hash on an unknown username as on a known
 * one, so login does not reveal via timing whether a username exists.
 */
const DUMMY_HASH =
  "scrypt:00000000000000000000000000000000:" +
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

/**
 * Verify a username/password pair against provisioned accounts.
 *
 * Fails closed: missing input, an unknown username, or no accounts at all
 * all deny access rather than admitting anyone.
 */
export async function verifyCredentials(
  username: string | undefined | null,
  password: string | undefined | null,
  storage: Storage,
): Promise<boolean> {
  if (!username || !password) return false;

  const account = await storage.getAccount(username);
  const passwordOk = await verifyPassword(password, account?.passwordHash ?? DUMMY_HASH);
  return passwordOk && account !== null;
}

/**
 * Whether this role must supply its own Gemini API key at login.
 *
 * Only `admin` is exempt - it keeps using the server's own `GEMINI_API_KEY`.
 * See add-per-session-gemini-key proposal.md.
 */
export function accountRequiresApiKey(role: AccountRole): boolean {
  return role !== "admin";
}
