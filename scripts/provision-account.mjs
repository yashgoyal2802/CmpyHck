#!/usr/bin/env node
/**
 * Owner-facing account provisioning. There is no self-service signup route
 * (see openspec/changes/add-accounts-cache-and-organizer/specs/user-accounts)
 * — this script is the only way an account gets created or its password reset.
 *
 * Duplicates the scrypt hashing scheme in src/lib/auth/password.ts rather
 * than importing it, so this script has no dependency on the Next.js/TS
 * build and can run with plain `node`.
 *
 * Usage: npm run provision-account -- <username> <password> [--role admin|standard|search_only]
 */
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

const scrypt = promisify(scryptCallback);
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const ROLES = ["admin", "standard", "search_only"];
const USAGE =
  "Usage: npm run provision-account -- <username> <password> [--role admin|standard|search_only]";

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEY_BYTES);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Pulls --role <value> out of argv, wherever it appears; leaves the rest as positional args. */
function parseArgs(argv) {
  const args = [...argv];
  const roleFlagIndex = args.indexOf("--role");
  let role = null;
  if (roleFlagIndex !== -1) {
    role = args[roleFlagIndex + 1];
    args.splice(roleFlagIndex, 2);
  }
  const [username, password] = args;
  return { username, password, role };
}

async function main() {
  const { username, password, role } = parseArgs(process.argv.slice(2));
  if (!username || !password) {
    console.error(USAGE);
    process.exit(1);
  }
  if (role !== null && !ROLES.includes(role)) {
    console.error(`--role must be one of: ${ROLES.join(", ")}`);
    console.error(USAGE);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("Set DATABASE_URL (or POSTGRES_URL) before running this script.");
    process.exit(1);
  }

  const sql = neon(connectionString);
  await sql.query(`CREATE TABLE IF NOT EXISTS accounts (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'standard' CHECK (role IN ('admin', 'standard', 'search_only')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const passwordHash = await hashPassword(password);
  // On a brand-new account, role defaults to 'standard' unless --role was
  // given. On an existing account (password reset), an omitted --role
  // leaves that account's current role untouched rather than silently
  // resetting it to 'standard' — a plain password reset must never also be
  // a quiet demotion.
  await sql.query(
    `INSERT INTO accounts (username, password_hash, role) VALUES ($1, $2, COALESCE($3, 'standard'))
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = COALESCE($3, accounts.role)`,
    [username, passwordHash, role],
  );

  const roleNote = role ? ` with role "${role}"` : "";
  console.log(
    `Account "${username}" provisioned${roleNote} (created, or password updated if it already existed).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
