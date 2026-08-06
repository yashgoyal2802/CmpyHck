import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { NewsItem } from "@/lib/brief/types";
import type {
  Account,
  CompanyCacheEntry,
  LastSeenNews,
  OrganizerEntry,
  OrganizerEntryInput,
  Storage,
} from "./types";

/**
 * DDL for the three tables this app needs. Run lazily and idempotently
 * (`CREATE TABLE IF NOT EXISTS`) on first use rather than through a separate
 * migration tool — the schema is small and changes rarely enough that a
 * migration framework would be more machinery than the problem needs.
 */
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS accounts (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS company_cache (
    company_key TEXT PRIMARY KEY,
    resolved_name TEXT NOT NULL,
    overview JSONB NOT NULL,
    classification JSONB NOT NULL,
    deep_dive JSONB NOT NULL,
    four_p JSONB,
    sources JSONB NOT NULL,
    cached_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS last_seen_news (
    company_key TEXT PRIMARY KEY REFERENCES company_cache(company_key) ON DELETE CASCADE,
    items JSONB NOT NULL,
    seen_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS organizer_entries (
    username TEXT NOT NULL,
    company_key TEXT NOT NULL,
    resolved_name TEXT NOT NULL,
    prepped BOOLEAN NOT NULL DEFAULT false,
    -- Plain text, not DATE: the driver round-trips DATE through a JS Date
    -- object and re-serializes it in UTC, which silently shifts the date by
    -- a day for any timezone ahead of UTC. This column is never used in SQL
    -- date arithmetic, so there is no reason to pay that cost.
    interview_date TEXT,
    confidence SMALLINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, company_key)
  )`,
];

let schemaReady: Promise<void> | null = null;

function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  schemaReady ??= (async () => {
    for (const statement of SCHEMA_STATEMENTS) {
      await sql.query(statement);
    }
  })();
  return schemaReady;
}

export interface PostgresStorageOptions {
  /** Connection string. Vercel's Neon integration injects `DATABASE_URL` / `POSTGRES_URL`. */
  connectionString: string;
}

export function createPostgresStorage(options: PostgresStorageOptions): Storage {
  const sql = neon(options.connectionString);
  const ready = () => ensureSchema(sql);

  return {
    async getAccount(username) {
      await ready();
      const rows = await sql.query(
        "SELECT username, password_hash FROM accounts WHERE username = $1",
        [username],
      );
      const row = rows[0] as { username: string; password_hash: string } | undefined;
      return row ? { username: row.username, passwordHash: row.password_hash } : null;
    },

    async getCompanyCache(companyKey) {
      await ready();
      const rows = await sql.query(
        `SELECT company_key, resolved_name, overview, classification, deep_dive, four_p, sources, cached_at
         FROM company_cache WHERE company_key = $1`,
        [companyKey],
      );
      const row = rows[0] as CompanyCacheRow | undefined;
      return row ? rowToCacheEntry(row) : null;
    },
    async putCompanyCache(entry: CompanyCacheEntry) {
      await ready();
      await sql.query(
        `INSERT INTO company_cache
           (company_key, resolved_name, overview, classification, deep_dive, four_p, sources, cached_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (company_key) DO UPDATE SET
           resolved_name = EXCLUDED.resolved_name,
           overview = EXCLUDED.overview,
           classification = EXCLUDED.classification,
           deep_dive = EXCLUDED.deep_dive,
           four_p = EXCLUDED.four_p,
           sources = EXCLUDED.sources,
           cached_at = EXCLUDED.cached_at`,
        [
          entry.companyKey,
          entry.resolvedName,
          JSON.stringify(entry.overview),
          JSON.stringify(entry.classification),
          JSON.stringify(entry.deepDive),
          entry.fourP ? JSON.stringify(entry.fourP) : null,
          JSON.stringify(entry.sources),
          entry.cachedAt,
        ],
      );
    },

    async getLastSeenNews(companyKey) {
      await ready();
      const rows = await sql.query(
        "SELECT company_key, items, seen_at FROM last_seen_news WHERE company_key = $1",
        [companyKey],
      );
      const row = rows[0] as { company_key: string; items: NewsItem[]; seen_at: string } | undefined;
      return row ? { companyKey: row.company_key, items: row.items, seenAt: row.seen_at } : null;
    },
    async putLastSeenNews(companyKey: string, items: NewsItem[], seenAt: string) {
      await ready();
      await sql.query(
        `INSERT INTO last_seen_news (company_key, items, seen_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_key) DO UPDATE SET items = EXCLUDED.items, seen_at = EXCLUDED.seen_at`,
        [companyKey, JSON.stringify(items), seenAt],
      );
    },

    async listOrganizerEntries(username) {
      await ready();
      const rows = await sql.query(
        `SELECT username, company_key, resolved_name, prepped, interview_date, confidence, updated_at
         FROM organizer_entries WHERE username = $1 ORDER BY updated_at DESC`,
        [username],
      );
      return (rows as OrganizerRow[]).map(rowToOrganizerEntry);
    },
    async getOrganizerEntry(username, companyKey) {
      await ready();
      const rows = await sql.query(
        `SELECT username, company_key, resolved_name, prepped, interview_date, confidence, updated_at
         FROM organizer_entries WHERE username = $1 AND company_key = $2`,
        [username, companyKey],
      );
      const row = rows[0] as OrganizerRow | undefined;
      return row ? rowToOrganizerEntry(row) : null;
    },
    async putOrganizerEntry(entry: OrganizerEntryInput) {
      await ready();
      const rows = await sql.query(
        `INSERT INTO organizer_entries
           (username, company_key, resolved_name, prepped, interview_date, confidence, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (username, company_key) DO UPDATE SET
           resolved_name = EXCLUDED.resolved_name,
           prepped = EXCLUDED.prepped,
           interview_date = EXCLUDED.interview_date,
           confidence = EXCLUDED.confidence,
           updated_at = now()
         RETURNING username, company_key, resolved_name, prepped, interview_date, confidence, updated_at`,
        [
          entry.username,
          entry.companyKey,
          entry.resolvedName,
          entry.prepped,
          entry.interviewDate,
          entry.confidence,
        ],
      );
      return rowToOrganizerEntry(rows[0] as OrganizerRow);
    },
  };
}

interface CompanyCacheRow {
  company_key: string;
  resolved_name: string;
  overview: CompanyCacheEntry["overview"];
  classification: CompanyCacheEntry["classification"];
  deep_dive: CompanyCacheEntry["deepDive"];
  four_p: CompanyCacheEntry["fourP"];
  sources: CompanyCacheEntry["sources"];
  cached_at: string;
}

function rowToCacheEntry(row: CompanyCacheRow): CompanyCacheEntry {
  return {
    companyKey: row.company_key,
    resolvedName: row.resolved_name,
    overview: row.overview,
    classification: row.classification,
    deepDive: row.deep_dive,
    fourP: row.four_p,
    sources: row.sources,
    cachedAt: row.cached_at,
  };
}

interface OrganizerRow {
  username: string;
  company_key: string;
  resolved_name: string;
  prepped: boolean;
  interview_date: string | null;
  confidence: number | null;
  updated_at: string;
}

function rowToOrganizerEntry(row: OrganizerRow): OrganizerEntry {
  return {
    username: row.username,
    companyKey: row.company_key,
    resolvedName: row.resolved_name,
    prepped: row.prepped,
    interviewDate: row.interview_date,
    confidence: row.confidence as OrganizerEntry["confidence"],
    updatedAt: row.updated_at,
  };
}
