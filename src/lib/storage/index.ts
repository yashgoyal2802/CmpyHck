import { randomBytes, scryptSync } from "node:crypto";
import { BriefError } from "@/lib/brief/errors";
import { createMemoryStorage } from "./memory";
import { createPostgresStorage } from "./postgres";
import type { Storage } from "./types";

/** Same format as src/lib/auth/password.ts, computed synchronously for startup seeding only. */
function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export type { Storage } from "./types";
export type {
  Account,
  CompanyCacheEntry,
  ConfidenceRating,
  LastSeenNews,
  OrganizerEntry,
  OrganizerEntryInput,
} from "./types";

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
    const devUsername = env.DEV_ACCOUNT_USERNAME?.trim();
    const devPassword = env.DEV_ACCOUNT_PASSWORD;
    cached = createMemoryStorage(
      devUsername && devPassword
        ? { accounts: [{ username: devUsername, passwordHash: hashPasswordSync(devPassword) }] }
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
