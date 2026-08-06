import type { Claim, Classification, DeepDive, FourPSection, NewsItem, SourceRef } from "@/lib/brief/types";

/**
 * The storage seam.
 *
 * Mirrors `BriefProvider`: the pipeline, auth, and organizer talk to this
 * interface, not to Postgres directly, so the hosted database can be swapped
 * (see design.md Open Questions) without touching call sites. `memory.ts` is
 * the fixture-equivalent implementation used in tests and `STORAGE_PROVIDER=memory`.
 */
export interface Storage {
  getAccount(username: string): Promise<Account | null>;

  getCompanyCache(companyKey: string): Promise<CompanyCacheEntry | null>;
  putCompanyCache(entry: CompanyCacheEntry): Promise<void>;

  getLastSeenNews(companyKey: string): Promise<LastSeenNews | null>;
  putLastSeenNews(companyKey: string, items: NewsItem[], seenAt: string): Promise<void>;

  listOrganizerEntries(username: string): Promise<OrganizerEntry[]>;
  getOrganizerEntry(username: string, companyKey: string): Promise<OrganizerEntry | null>;
  putOrganizerEntry(entry: OrganizerEntryInput): Promise<OrganizerEntry>;
}

export interface Account {
  username: string;
  passwordHash: string;
}

/** Stable parts of a company's research, keyed on the normalized company name. */
export interface CompanyCacheEntry {
  companyKey: string;
  resolvedName: string;
  overview: Claim;
  classification: Classification;
  deepDive: DeepDive;
  fourP: FourPSection | null;
  /** Origin-prefixed (`c1, c2, ...`) so they never collide with a fresh request's `n1, n2, ...`. */
  sources: SourceRef[];
  cachedAt: string;
}

/** Last-shown news, kept only to compute the "what's changed" diff — never served as current. */
export interface LastSeenNews {
  companyKey: string;
  items: NewsItem[];
  seenAt: string;
}

export type ConfidenceRating = 1 | 2 | 3 | 4 | 5;

export interface OrganizerEntry {
  username: string;
  companyKey: string;
  resolvedName: string;
  prepped: boolean;
  interviewDate: string | null;
  confidence: ConfidenceRating | null;
  updatedAt: string;
}

export type OrganizerEntryInput = Omit<OrganizerEntry, "updatedAt">;
