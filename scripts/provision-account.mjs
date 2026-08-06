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
 * Usage: npm run provision-account -- <username> <password>
 */
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

const scrypt = promisify(scryptCallback);
const SALT_BYTES = 16;
const KEY_BYTES = 64;

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEY_BYTES);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: npm run provision-account -- <username> <password>");
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const passwordHash = await hashPassword(password);
  await sql.query(
    `INSERT INTO accounts (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, passwordHash],
  );

  console.log(`Account "${username}" provisioned (created, or password updated if it already existed).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
