## 1. Storage: bookmark + status columns

- [x] 1.1 Add `bookmarked: boolean` and `status: OrganizerStatus` to `OrganizerEntry`/`OrganizerEntryInput` in `src/lib/storage/types.ts`; define the `OrganizerStatus` string-literal union (`"tracking" | "prepping" | "interview_scheduled" | "interviewed" | "offer" | "not_selected"`); remove `prepped` from the type.
- [x] 1.2 In `src/lib/storage/postgres.ts`, extend `SCHEMA_STATEMENTS`/`ensureSchema()` with the additive migration from design.md §Decision 3 (add `bookmarked`, add nullable `status`, backfill from `prepped`, set `status` `NOT NULL`/`DEFAULT`, add the `CHECK` constraint) — do **not** drop `prepped` yet.
- [x] 1.3 Update `postgres.ts`'s `listOrganizerEntries`/`getOrganizerEntry`/`putOrganizerEntry` queries and row mappers to read/write `status`/`bookmarked` instead of `prepped`.
- [x] 1.4 Update `src/lib/storage/memory.ts` to match the new `OrganizerEntry` shape.
- [x] 1.5 Update any existing tests/fixtures that construct `OrganizerEntry`/`OrganizerEntryInput` with `prepped`.

## 2. API: organizer status + bookmark

- [x] 2.1 Update `src/app/api/organizer/route.ts` POST handler to accept/validate `status` (must be one of the six values) and `bookmarked` (boolean) instead of `prepped`, and pass them through to `putOrganizerEntry`.
- [x] 2.2 Confirm GET `/api/organizer` naturally returns the new fields (no server-side filtering needed) since it just serializes `listOrganizerEntries`.

## 3. Brief schema: strategic framework (4P → Five Forces alternative)

- [x] 3.1 In `src/lib/brief/types.ts`, add `fiveForcesEntrySchema`/`fiveForcesSectionSchema` mirroring `fourPEntrySchema`/`fourPSectionSchema` (five named forces: competitive rivalry, supplier power, buyer power, threat of substitutes, threat of new entrants; each a claim with `basis`/`sourceIds`).
- [x] 3.2 Replace `fourP: fourPSectionSchema.nullable()` on `companyBriefSchema` with a discriminated `framework` field (`{ kind: "four_p", ...fourPSectionSchema } | { kind: "five_forces", ...fiveForcesSectionSchema }`); update `CompanyCacheEntry` in `src/lib/storage/types.ts` the same way.
- [x] 3.3 Update `src/lib/brief/plan.ts`'s `SectionPlan` (`includeFourP: boolean` → `framework: "four_p" | "five_forces"`, still derived from `fourPApplies`).
- [x] 3.4 Update `src/lib/providers/prompts.ts` and `src/lib/providers/draft.ts`/`types.ts` to request/parse Five Forces content from the model when the plan calls for it, mirroring the existing 4P prompt path.
- [x] 3.5 Update `src/lib/providers/fake.ts` test provider to emit both framework kinds.
- [x] 3.6 Update `src/lib/brief/assemble.ts` to enforce basis/citation validity on whichever framework the plan selected (mirroring today's 4P enforcement block), and to record an `unavailableNotes` entry if the plan wanted a framework the draft didn't provide.
- [x] 3.7 In `src/lib/storage/postgres.ts`, rename/adjust the `four_p JSONB` column handling to store the discriminated `framework` value; on read, if a stored `company_cache` row fails to parse against the new schema, treat it as a cache miss (per design.md §Decision 4) rather than throwing.
- [x] 3.8 Update `src/lib/brief/compare.ts` and any other code touching `fourP` directly to use `framework` instead.

## 4. Brief dashboard UI

- [x] 4.1 Add a stat-tile summary row component (sector badge, classification confidence, sourced-vs-inferred ratio computed client-side from the brief's claim-bearing fields, source count, talking-points count, interviewer-questions count) rendered at the top of `BriefView.tsx`, above the existing prose sections.
- [x] 4.2 Build a Five Forces display component (five force cards) and wire it into `BriefView.tsx` alongside an upgraded 4P display (explicit 2×2 quadrant layout replacing the current 2-column text grid), rendering whichever `framework.kind` the brief has.

## 5. Bookmarks

- [x] 5.1 Add a ★ bookmark toggle button to `BriefView.tsx`'s header (next to Copy/Force refresh), calling `POST /api/organizer` with `bookmarked` flipped and the entry's current other fields (fetch current entry first, same pattern `OrganizerPanel` already uses).
- [x] 5.2 Create `src/app/saved/page.tsx`: server component, gated the same way as `organizer/page.tsx`, listing entries where `bookmarked === true` (name + last-cached date if available).
- [x] 5.3 Add "Saved" to `AppHeader`'s `NAV_ITEMS` and its `active` union type.
- [x] 5.4 Update `src/app/page.tsx` to read `company` from `searchParams` and pass it to `BriefWorkspace` as an initial value.
- [x] 5.5 Update `BriefWorkspace.tsx` to accept an initial company name and auto-run the search once on mount when present (design.md §Decision 5).
- [x] 5.6 Link each Saved-tab row to `/?company=<resolvedName>`.

## 6. Tracker status pipeline UI

- [x] 6.1 Replace the prepped checkbox in `OrganizerPanel.tsx` with a status `<select>` covering all six values; update its save payload accordingly.
- [x] 6.2 Add an inline status `<select>` to each row in `src/app/organizer/page.tsx` (`OrganizerRow`), posting to `/api/organizer` with the row's full current data and the newly chosen status (design.md §Decision 6); reflect the change optimistically or via revalidation.
- [x] 6.3 Update the organizer page's stat tiles / accent-bar logic (added in the earlier UI polish pass) to key off `status` instead of `prepped`.

## 7. UI redesign — shared foundation

- [x] 7.1 Rework `src/app/globals.css` tokens so the base surface reads as near-white (not the current off-white tint) while keeping purple-forward text/heading/icon usage consistent across light and dark.
- [x] 7.2 Restructure `AppHeader.tsx` layout/spacing to match the reference design's header composition (logo, nav, saved/bell/avatar cluster) beyond the prior token-only pass.

## 8. UI redesign — pages

- [x] 8.1 Rebuild `src/app/page.tsx` / `BriefWorkspace.tsx` hero and search layout to match the reference design's structure (not just spacing/shadow tweaks).
- [x] 8.2 Rebuild `src/app/compare/page.tsx` / `ComparisonWorkspace.tsx` layout.
- [x] 8.3 Rebuild `src/app/organizer/page.tsx` layout (stat tiles + pipeline-style presentation of the six statuses).
- [x] 8.4 Rebuild `src/app/saved/page.tsx` layout to match the same visual system (new page, built fresh rather than retrofitted).
- [x] 8.5 Rebuild `src/app/signin/page.tsx` layout, keeping the existing `PasswordField` show/hide toggle.
- [x] 8.6 Update `BriefView.tsx`'s section cards (beyond the dashboard row and framework module already covered in tasks 4.1/4.2) to match the reference visual system.

## 9. Migration follow-through

- [x] 9.1 Verify the `status` backfill against real `organizer_entries` data (read-only check) after step 1's migration has run in production.
- [x] 9.2 Ship a follow-up statement dropping the `prepped` column from `organizer_entries` once 9.1 is confirmed clean (design.md §Migration Plan step 3) — separate deploy from the additive migration.

## 10. Verification

- [x] 10.1 Run `npm run typecheck` and `npm test` (`vitest run`).
- [ ] 10.2 Manually verify: bookmarking a company, reopening it from Saved (cache hit and forced-expired paths), setting each of the six statuses from both the organizer list and the brief page, a 4P-sector brief and a Five-Forces-sector brief both rendering their dashboard + framework correctly, and all four pages/signin visually matching the reference design in a browser.
