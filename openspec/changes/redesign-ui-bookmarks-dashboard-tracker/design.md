## Context

This builds on top of `add-accounts-cache-and-organizer` (in progress, 47/49
tasks done, specs already written for `personal-organizer`,
`company-research-cache`, `company-comparison`, `user-accounts`; only
`company-preparation-brief` has been archived to `openspec/specs/` so far).
This change treats that prior change's specs as the current baseline for
`personal-organizer` even though they have not been archived yet, since that
work is functionally complete.

Relevant current shape:
- `Storage` (`src/lib/storage/types.ts`) is a hand-written interface over a
  Neon Postgres table set, with lazy idempotent `CREATE TABLE IF NOT EXISTS`
  DDL in `postgres.ts` and a `memory.ts` fixture mirror used in tests. There
  is no migration framework.
- `OrganizerEntry` today: `{ username, companyKey, resolvedName, prepped,
  interviewDate, confidence, updatedAt }`, one row per `(username,
  companyKey)`, created only when `OrganizerPanel`'s save form posts to
  `/api/organizer`.
- `CompanyBrief.fourP` (`src/lib/brief/types.ts`) is `fourPSectionSchema.nullable()`,
  populated by `assemble.ts` based on `SectionPlan.includeFourP`, itself
  derived from `SECTOR_POLICY[sector].fourP` (`always | never |
  byRoleRelevance`) in `src/lib/brief/sectors.ts`. The same policy value also
  drives the provider prompt (`src/lib/providers/prompts.ts`) and the raw
  draft shape (`src/lib/providers/draft.ts`).
- `company_cache` stores the assembled stable facts (including `four_p
  JSONB`) keyed by `company_key`, reused across users, expiring on a
  configured window.
- This is a **live app**: a real Neon database with provisioned accounts and
  already-cached briefs. Every storage and schema change here must be safe
  against that existing data, not just against a fresh database.
- Visual reference for the UI redesign is the Stitch project referenced in
  chat (id `6265644864897065810`) — purple-forward text/headings/icons on a
  near-white surface, card/stat-tile/pipeline layouts per screen. Colors
  already live as CSS custom properties in `src/app/globals.css`
  (`--color-primary` etc.); this change adjusts those tokens and page/
  component structure, not the token mechanism itself.

## Goals / Non-Goals

**Goals:**
- Ship all four pieces (redesign, bookmarks, dashboard, tracker status) as
  one coherent change, since they share the `OrganizerEntry` row and the
  organizer/brief pages.
- Keep the storage layer's existing "lazy idempotent DDL, no migration
  framework" convention rather than introducing a new one.
- Make both breaking changes (`prepped`→`status`, `fourP`→`framework`) safe
  to deploy against the live database without a maintenance window or manual
  intervention.

**Non-Goals:**
- The multi-framework catalog (SWOT, BCG matrix, PESTEL, ...) beyond 4P and
  Five Forces — explicitly deferred; only Five Forces is added as the 4P
  alternative in this change.
- Automatic status transitions (e.g. inferring "interview scheduled" from a
  set interview date) — status is manually set only in this change.
- Any change to the comparison workflow's data model (`ComparisonWorkspace`
  gets the visual redesign only, not new features).

## Decisions

### 1. Bookmark lives on `OrganizerEntry`, not a new table
**Decision**: add `bookmarked: boolean NOT NULL DEFAULT false` to
`organizer_entries` / `OrganizerEntry`, rather than a separate
`bookmarks` table.

**Why**: an organizer entry is already exactly "a user's private reference to
a company," which is what a bookmark is. A second table would duplicate that
reference and require reconciling two rows for the same `(username,
companyKey)` pair whenever a company is both bookmarked and tracked.

**Alternative considered**: separate `bookmarks` table, decoupled entirely.
Rejected — no upside once bookmark and tracking are both optional,
independent fields on the same row (a bookmark-only entry simply has
`status = 'tracking'`, `interviewDate = null`, `confidence = null`,
`bookmarked = true`, and never shows up as a false "actively tracked" entry
in the Saved list because the Saved list filters on `bookmarked`, not on
status).

### 2. Status replaces `prepped`, encoded as a Postgres `TEXT` + `CHECK` constraint
**Decision**: `status TEXT NOT NULL DEFAULT 'tracking' CHECK (status IN
('tracking','prepping','interview_scheduled','interviewed','offer',
'not_selected'))`, mirrored in TypeScript as a string-literal union, not a
Postgres `ENUM` type.

**Why**: Postgres `ENUM` types require `ALTER TYPE ... ADD VALUE` migrations
(and can't run inside the same transaction as their first use in older
Postgres versions) if the status set ever grows; a `TEXT` + `CHECK` column is
just a `DROP CONSTRAINT` / `ADD CONSTRAINT` pair to change, consistent with
this codebase's "no migration framework, just idempotent DDL" convention.

### 3. Migration: additive columns + one-time backfill, run from the existing lazy-DDL path
**Decision**: extend `ensureSchema()` in `postgres.ts` with:
```sql
ALTER TABLE organizer_entries ADD COLUMN IF NOT EXISTS bookmarked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organizer_entries ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE organizer_entries SET status = CASE WHEN prepped THEN 'prepping' ELSE 'tracking' END WHERE status IS NULL;
ALTER TABLE organizer_entries ALTER COLUMN status SET NOT NULL;
ALTER TABLE organizer_entries ALTER COLUMN status SET DEFAULT 'tracking';
ALTER TABLE organizer_entries ADD CONSTRAINT organizer_status_check CHECK (status IN (...)) [added conditionally — see Risks];
ALTER TABLE organizer_entries DROP COLUMN IF EXISTS prepped;
```
run in that order, every one idempotent (`IF NOT EXISTS` / `IF NOT NULL`
guarded / re-runnable `UPDATE ... WHERE status IS NULL`).

**Why**: this follows the file's existing pattern exactly (`SCHEMA_STATEMENTS`
run lazily on first use) rather than introducing a migration tool for a
change this size. The backfill runs unconditionally but is a no-op after the
first successful run because it only touches rows where `status IS NULL`.

**Alternative considered**: keep `prepped` alongside the new `status` column
indefinitely instead of dropping it. Rejected — the spec explicitly retires
the boolean concept in favor of status, and keeping both invites them to
drift out of sync in application code.

### 4. Brief schema: `fourP` (nullable) becomes `framework` (discriminated union), old cache rows are treated as stale
**Decision**: replace `fourP: fourPSectionSchema.nullable()` with `framework:
z.discriminatedUnion("kind", [fourPFrameworkSchema, fiveForcesFrameworkSchema])`
(kind: `"four_p" | "five_forces"`) on `CompanyBrief` and on `CompanyCacheEntry`.
When reading a `company_cache` row whose stored JSON doesn't match the new
schema (i.e. an old row with the pre-change `four_p` shape or a `null`),
treat the cache read as a miss and re-research the company, the same
code path already used for "no cached entry" and "expired entry."

**Why**: `company_cache` has no schema version column and this codebase's
existing philosophy (per `assemble.ts`'s comments) is "enforce, don't trust" —
a row that fails the new schema is exactly the "missing/invalid cache" case
the pipeline already knows how to handle by re-researching, so no new state
machine is needed. This also means no destructive migration of
`company_cache` is required: stale rows age out naturally as each company is
next searched, and until then they simply trigger a re-research instead of a
crash.

**Alternative considered**: write a one-time backfill that regenerates
`framework` for every cached row from its old `four_p` value. Rejected —
sectors that previously had `fourP: null` (i.e. most non-FMCG sectors) have
no Five Forces content to backfill from; a real backfill would mean
re-researching every cached company anyway, which is exactly what "treat as
a cache miss" already achieves lazily, without a batch job.

### 5. Home page auto-search via `?company=` query param, not a client-only prop
**Decision**: `src/app/page.tsx` reads `searchParams.company` server-side and
passes it to `BriefWorkspace` as an initial value that triggers `run()`
automatically on mount if present, rather than `BriefWorkspace` reading
`window.location` itself.

**Why**: keeps the existing server/client boundary (page reads
`searchParams`, already an established Next.js pattern used elsewhere in
this app) and makes the "open a saved company" link a plain `<Link
href="/?company=...">`, so it works without JavaScript before hydration and
is trivially testable as a URL.

### 6. Inline status editing on `/organizer` reuses the existing `POST /api/organizer` upsert
**Decision**: the organizer page's status dropdown calls the same
`/api/organizer` POST endpoint used by `OrganizerPanel`, sending the full
current entry (companyKey, resolvedName, status, interviewDate, confidence,
bookmarked) with just `status` changed, rather than adding a separate PATCH
endpoint.

**Why**: `putOrganizerEntry` is already an upsert keyed on `(username,
companyKey)`; a second partial-update endpoint would just be an alternate
way to call the same storage method. The organizer page already has each
row's full current data (from `listOrganizerEntries`), so composing the full
payload client-side costs nothing.

## Risks / Trade-offs

- **[Risk]** Adding a `CHECK` constraint on `status` (`ALTER TABLE ... ADD
  CONSTRAINT ... CHECK (...)`) validates every existing row at migration
  time; if the backfill step has a bug, this constraint will fail the
  migration loudly at startup rather than corrupting data silently.
  → **Mitigation**: this is the desired behavior (fail loud, not silent
  corruption), but the backfill `UPDATE` must run and commit before the
  `ADD CONSTRAINT` statement in the same `ensureSchema()` sequence — task
  order matters and is captured explicitly in tasks.md.
- **[Risk]** Old `company_cache` rows silently start "not caching" for every
  previously-cached company on first deploy (since they now fail the new
  `framework` schema and are treated as cache misses), causing a burst of
  re-research calls to the LLM/search provider right after deploy.
  → **Mitigation**: this is bounded and self-healing — each affected company
  only re-researches once, on its next search, and the existing "provider
  failure handling" requirement already covers what happens if research
  fails at that moment (report and let the user retry, no fabrication). No
  action needed beyond being aware the first hour post-deploy will see more
  provider calls than usual.
- **[Trade-off]** Dropping the `prepped` column instead of deprecating it
  means there's no fallback read path if `status` backfill logic has a bug
  discovered after deploy. → **Mitigation**: verify the backfill against a
  copy of production data (or the actual `organizer_entries` table, read-only)
  before running the `DROP COLUMN` statement in a follow-up deploy, i.e. do
  not ship `ADD status` and `DROP prepped` in the same statement batch —
  ship the additive/backfill statements first, verify, then ship the drop
  (captured as separate tasks).
- **[Trade-off]** Five Forces generation is new LLM prompt surface (unlike
  the dashboard stat-tile row, which is pure presentation) — it can fail,
  return low-quality content, or increase latency/cost versus today's
  "sometimes nothing" behavior for non-FMCG sectors. → **Mitigation**: follow
  the exact same non-negotiable enforcement `assemble.ts` already applies to
  every other claim-bearing section (`enforceBasis`, citation validation,
  "insufficient evidence" notes) rather than trusting the prompt.

## Migration Plan

1. Deploy schema changes first (additive only): `bookmarked` column,
   nullable `status` column + backfill `UPDATE`, `status` `NOT NULL` +
   `DEFAULT` + `CHECK` constraint. `prepped` column still present and
   unused by application code after this step.
2. Deploy application code reading/writing `status`/`bookmarked` instead of
   `prepped` (this is the point at which `CompanyBrief.framework` also goes
   live; old `company_cache` rows begin being treated as misses, see Risks).
3. After confirming step 2 is stable in production, ship a follow-up
   statement dropping the `prepped` column.
4. No rollback path that preserves new data if step 2 is rolled back after
   users have set new `status`/`bookmarked` values or new-shape briefs have
   been cached — rollback before step 2 is safe (schema is purely additive
   up to that point); rollback after step 2 requires accepting loss of any
   `status` values beyond the `prepped` boolean's expressiveness.
