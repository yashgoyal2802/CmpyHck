## Why

The app currently works but reads as a plain form-and-list tool rather than a
polished placement-prep product: the visual design only loosely reflects the
purple brand identity the user wants, there is no way to quickly return to a
company already researched without re-typing its name, every brief presents
the same wall of prose regardless of how much a reader could take in at a
glance, and the organizer only tracks a binary prepped/not-prepped state that
does not reflect how a placement season actually progresses (tracking a
company, prepping for it, having a scheduled interview, hearing back). This
change addresses all four together because they were scoped and sequenced in
one collaborative design session and share a single underlying data row
(`OrganizerEntry`) and page set (home, organizer, brief).

## What Changes

- **UI redesign**: restructure (not just recolor) the home/search, compare,
  organizer, and sign-in pages plus `AppHeader`, `BriefView`, `BriefWorkspace`,
  `ComparisonWorkspace`, and `OrganizerPanel` to match the purple-forward,
  near-white, card/stat-tile visual language established as a reference
  design. Existing shadow tokens (`shadow-elevation-1/2`) and the sign-in
  password-visibility toggle already exist and are kept; this change goes
  further structurally (hero layouts, card grids, stat-tile rows, pipeline-
  style organizer columns) rather than just adjusting tokens.
- **Bookmarking**: add a `bookmarked` boolean to `OrganizerEntry`, toggled
  independently of the prep-tracking fields via a star control on the brief
  header. Add a "Saved" nav tab listing bookmarked companies. Selecting a
  saved company opens the home page with that company pre-filled and
  automatically searched (new `?company=` query-param support), reusing the
  existing research cache — no new brief-content storage.
- **Brief dashboard**: add a stat-tile summary row to the brief, built only
  from data already in `CompanyBrief` (sector, classification confidence,
  sourced-vs-inferred ratio, source count, talking-point and
  interviewer-question counts) — purely presentational, no new generation.
- **Strategic framework module**: every brief gets exactly one strategic
  framework, mutually exclusive with today's "sometimes nothing" 4P section.
  Sectors where `fourPApplies` is true keep 4P (rendered as an explicit 2x2
  quadrant layout); sectors where it is false get a new Porter's Five Forces
  section instead, generated and schema-validated the same way 4P is today
  (per-force `basis`/`sourceIds`). **BREAKING**: `CompanyBrief.fourP` changes
  from "present only for some sectors, otherwise `null`" to one branch of a
  mutually-exclusive `framework` field; existing cached `company_cache` rows
  (which store the old shape) are treated as stale by the new reader, so
  they'll be re-researched on next access rather than crash.
- **Tracker status pipeline**: replace `OrganizerEntry.prepped: boolean` with
  a status enum (`tracking` → `prepping` → `interview_scheduled` →
  `interviewed` → `offer` | `not_selected`), manually set, editable inline via
  a dropdown on each `/organizer` row (today read-only there) and from the
  existing `OrganizerPanel` form on the brief page. **BREAKING**: existing
  `organizer_entries.prepped` column data is migrated automatically
  (`true`→`prepping`, `false`→`tracking`) as part of this change; `confidence`
  and `interview_date` are untouched.

## Capabilities

### New Capabilities
- `company-bookmarks`: let a user bookmark a researched company independently
  of prep tracking, and browse/reopen their bookmarked companies from a
  dedicated tab.
- `brief-dashboard`: present an at-a-glance visual summary (stat tiles) and
  exactly one strategic framework module (4P or Five Forces, sector-driven)
  on every company brief.

### Modified Capabilities
- `personal-organizer`: preparation status changes from a boolean
  (prepped/not-prepped) to a multi-stage status pipeline, and status becomes
  editable directly from the organizer list view, not only from a company's
  brief page.
- `company-preparation-brief`: the brief's optional 4P section becomes one
  branch of a mandatory, mutually-exclusive strategic-framework section
  (4P or Five Forces, never both, never neither).

## Impact

- **Data model / storage**: `src/lib/storage/types.ts`, `postgres.ts`,
  `memory.ts` — `OrganizerEntry` gains `bookmarked: boolean` and replaces
  `prepped: boolean` with a `status` enum; `organizer_entries` table needs an
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration (this schema has no
  migration framework — DDL runs lazily and idempotently in `postgres.ts`)
  plus a one-time backfill of `status` from existing `prepped` values.
- **Brief schema/generation**: `src/lib/brief/types.ts` (new
  `fiveForcesSchema` alongside `fourPSectionSchema`, replacing the standalone
  nullable `fourP` field with a discriminated `framework` field),
  `src/lib/brief/sectors.ts`, `src/lib/brief/plan.ts`, `src/lib/brief/
  assemble.ts`, `src/lib/providers/prompts.ts`, `draft.ts`, `types.ts`,
  `fake.ts` (five-forces prompt/generation mirroring the existing 4P path).
- **API routes**: `src/app/api/organizer` (status + bookmarked fields),
  `src/app/api/briefs` (support `?company=` driven auto-search on the home
  page).
- **UI**: `src/app/page.tsx`, `compare/page.tsx`, `organizer/page.tsx`,
  `signin/page.tsx`, `src/components/AppHeader.tsx`, `BriefView.tsx`,
  `BriefWorkspace.tsx`, `ComparisonWorkspace.tsx`, `OrganizerPanel.tsx`; new
  `src/app/saved/page.tsx` and a new five-forces display component.
- **Existing live data**: this app has a real Neon Postgres database with
  provisioned accounts and cached briefs already in production use; the
  `prepped`→`status` migration and the brief schema's breaking `fourP`→
  `framework` change must both be safe to run against that live data (see
  design.md).
