import { randomBytes, scryptSync } from "node:crypto";
import { BriefError } from "@/lib/brief/errors";
import { createMemoryStorage } from "./memory";
import { createPostgresStorage } from "./postgres";
import type { AccountRole, Storage } from "./types";

/** Same format as src/lib/auth/password.ts, computed synchronously for startup seeding only. */
function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export type { Storage } from "./types";
export { ACCOUNT_ROLES, ORGANIZER_STATUSES } from "./types";
export type {
  Account,
  AccountRole,
  CompanyCacheEntry,
  ConfidenceRating,
  LastSeenNews,
  OrganizerEntry,
  OrganizerEntryInput,
  OrganizerStatus,
} from "./types";

function isAccountRole(value: string | undefined): value is AccountRole {
  return value === "admin" || value === "standard" || value === "search_only";
}

let cached: Storage | null = null;

/**
 * Select the storage backend from the environment, mirroring `getProvider()`
 * in `src/lib/providers/index.ts`.
 *
 * `STORAGE_PROVIDER=memory` runs against an in-process store, which is how
 * this app is exercised in tests and local dev without provisioning a
 * database. Anything else requires `DATABASE_URL` (or `POSTGRES_URL`, which
 * Vercel's Neon integration also sets).
 */
export function getStorage(env: NodeJS.ProcessEnv = process.env): Storage {
  if (cached) return cached;

  if (env.STORAGE_PROVIDER === "memory") {
    // Dev-only convenience: seed one account from env so local testing
    // without a database doesn't also require hand-editing storage code.
    // DEV_ACCOUNT_ROLE defaults to "standard" (matching the DB column
    // default) but can be set to "admin" to exercise admin-only behavior
    // locally without a real provisioning run.
    const devUsername = env.DEV_ACCOUNT_USERNAME?.trim();
    const devPassword = env.DEV_ACCOUNT_PASSWORD;
    const devRoleRaw = env.DEV_ACCOUNT_ROLE?.trim();
    const devRole: AccountRole = isAccountRole(devRoleRaw) ? devRoleRaw : "standard";
    cached = createMemoryStorage(
      devUsername && devPassword
        ? {
            accounts: [
              { username: devUsername, passwordHash: hashPasswordSync(devPassword), role: devRole },
            ],
          }
        : undefined,
    );
    return cached;
  }

  const connectionString = env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim();
  if (!connectionString) {
    throw new BriefError(
      "not_configured",
      "DATABASE_URL is not set. Set it, or set STORAGE_PROVIDER=memory for local dev.",
    );
  }

  cached = createPostgresStorage({ connectionString });
  return cached;
}

/** Test-only: clear the cached singleton so a new getStorage() call re-selects the backend. */
export function resetStorageForTests(): void {
  cached = null;
}
