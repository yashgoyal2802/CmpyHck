## 1. Session: carry an isDemo flag

- [x] 1.1 In `src/lib/auth/session.ts`, extend `SessionPayload` with an optional `isDemo?: boolean`.
- [x] 1.2 Extend `encodePayload`/`decodePayload` to encode/decode a demo flag. **Deviates from the original plan**: placed it *after* the apiKey segment (position 5), not before (position 4) - putting it before would have shifted every existing keyed non-admin token's apiKey to a new position and broken every currently-issued session for a real logged-in user. A demo token (which never has a real apiKey) instead gets an empty placeholder at position 4 and the demo flag at position 5 (`exp.user.role..1`); every non-demo token's shape (3 or 4 segments) is byte-for-byte unchanged from before this task.
- [x] 1.3 Extend `createSessionToken` with an `isDemo` parameter (7th positional, consistent with how `ttlSeconds`/`now`/`apiKey` were already added one at a time) defaulting to `false`.
- [x] 1.4 In `src/lib/auth/server.ts`, add `startDemoSession()`: mints a token via `createSessionToken` with a fixed sentinel username (`DEMO_USERNAME = "__demo__"`), `role: "standard"` (never actually checked - see design.md), `isDemo: true`, no `apiKey`. `SessionAccount`/`getSessionAccount()` now surface `isDemo`.
- [x] 1.5 Added tests (`tests/auth.test.ts`): demo token round-trips with `isDemo: true`; apiKey never smuggled in alongside isDemo; every existing non-demo token shape is unchanged (including an explicit segment-count assertion); a tampered demo-flag splice onto a real token is rejected by signature verification. All 27 pre-existing auth tests still pass unmodified.

## 2. Sign-in page: the "Have a look" entry point

- [x] 2.1 In `src/app/signin/page.tsx`, added a second server action `enterDemo()` (separate `<form>`) that calls `startDemoSession()` and redirects to `/`, never touching `verifyCredentials` or reading any form field.
- [x] 2.2 Added the "Have a look" control below an "or" divider, outlined/secondary styling vs. the filled primary "Enter" button.

## 3. Middleware: exempt demo sessions from the Gemini-key rule

- [x] 3.1 In `src/middleware.ts`, `isUsableSession` now also accepts `session.isDemo` - narrow, additive clause, the existing non-demo rule untouched.
- [x] 3.2 Added middleware tests (`tests/middleware.test.ts`): a demo session reaches `/`, `/organizer`, `/compare`, `/saved`, and `/api/briefs` without redirect/401; a non-demo keyless standard session is still rejected exactly as before (explicit regression guard). All 19 pre-existing middleware tests still pass unmodified.

## 4. Fixture-backed demo search

- [x] 4.1 In `src/app/api/briefs/route.ts`, demo sessions branch early to `createFakeProvider({ fallbackToGeneric: false })`, called with no `storage` option so `generateBrief` runs with zero caching/DB interaction (per `pipeline.ts`'s own documented "storage omitted = no caching at all" behavior).
- [x] 4.2 Added `tests/demo-mode.test.ts` (route handlers aren't unit-tested anywhere in this codebase, so this exercises the exact provider+generateBrief call shape the route uses): a fixture name resolves with `brief.cache` undefined (confirming no caching path engaged); an unrecognized name rejects with `kind: "no_results"`.
- [x] 4.3 `BriefWorkspace` now accepts `isDemo`, swapping both the 3 "Try" chips and the input placeholder to `DEMO_EXAMPLES = ["Acme Consulting", "Northwind Foods", "Helios Tech"]`. Wired through from `src/app/page.tsx`.

## 5. Frozen saved page

- [x] 5.1 `src/app/saved/page.tsx` branches on `isDemo`: skips `getStorage().listOrganizerEntries(...)` entirely, passes a single hard-coded bookmarked entry (`demoSavedEntry()`, built around Acme Consulting via the real `companyCacheKey(normalizeCompanyName(...))` so it matches what a real search for that name would key to).
- [x] 5.2 `SavedList` accepts `isDemo` and disables its remove-bookmark button (opacity + `disabled` + explanatory `title`/`aria-label`) rather than letting a demo visitor unsave the one entry with no way to get it back this session.

## 6. Disabled organizer/compare actions

- [x] 6.1 `src/app/organizer/page.tsx` and `compare/page.tsx` pass `isDemo` down to `OrganizerBoard`/`ComparisonWorkspace`. Organizer skips the real storage read entirely for demo (empty array - see 6.3's note on why GET itself still serves fixture data for the brief-view bookmark star, but the page's own list stays empty/disabled-state rather than making any real DB call).
- [x] 6.2 Found during implementation: the actual write-capable controls aren't only on Organizer/Compare pages - `BriefView` (shown on the search page) has its own inline bookmark star and `OrganizerPanel` tracker form. Disabled all of them: `BookmarkButton` (disabled, no live fetch, "Sign in to bookmark" tooltip), `OrganizerPanel` swapped for a static "sign in to track" message card, `ComparisonWorkspace`'s Compare button (disabled + inline nudge), `SavedList`'s remove button (task 5.2). Exact visual treatment not run through `impeccable` yet - functional disabled-state only; flagged for a polish pass if the user wants one.
- [x] 6.3 `src/app/api/organizer/route.ts`: `GET` now returns a frozen single fixture entry for a demo session (mirrors `saved/page.tsx`'s `demoSavedEntry()`, so the brief-view bookmark star reads correctly for that one company too) rather than a real storage read; `POST`/`DELETE` reject with `demoRejected()` (403, `kind: "forbidden"`) before touching storage. `src/app/api/comparison/route.ts`'s `POST` rejects the same way, checked *before* the existing apiKey-required check (which would otherwise wrongly flag a demo session as `not_configured`).
- [x] 6.4 Added `tests/demo-api-rejection.test.ts` - mocks only `next/headers`'s `cookies()` (not `verifySessionToken`, which runs for real against a genuinely minted demo token), so these call the actual exported route handlers: `GET /api/organizer` returns the frozen entry; `POST`/`DELETE /api/organizer` and `POST /api/comparison` all reject a demo session with 403. This is real route-handler coverage, not just a re-test of the `isDemo` branch in isolation.

## 7. Demo-aware header and account menu

- [x] 7.1 `AppHeader` accepts `isDemo`; shows all nav items regardless of role when true, and swaps the account menu for a plain "Sign in" link instead of `UserMenu`'s real-username/sign-out dropdown.
- [x] 7.2 Added the demo banner directly under the header (`absolute top-full`, so it's anchored to the fixed header's own box) - present on every page that renders `AppHeader` with `isDemo` set, since all four gated pages now pass it through. Each page's `<main>` top padding bumps from `pt-16` to `pt-24` when `isDemo` so content doesn't sit under the extra banner height. Visual treatment is functional, not run through `impeccable` - flagged for a polish pass if wanted.

## 8. Verification

- [x] 8.1 Ran the full test suite: 183/183 pass (167 pre-existing + 16 new across `tests/auth.test.ts`, `tests/middleware.test.ts`, `tests/demo-mode.test.ts`, `tests/demo-api-rejection.test.ts`). Every pre-existing test passes unmodified.
- [x] 8.2 Manually verified end-to-end against the real running dev server (no browser tool available this session, so driven via curl with a genuinely signed demo session cookie minted through the real `createSessionToken`, and separately a genuinely signed real/non-demo cookie for the regression check - the sign-in form's server action itself isn't curl-drivable, same limitation noted earlier this session):
  - Demo cookie: `/`, `/saved`, `/organizer`, `/compare` all 200 (no redirect); home page shows the 3 demo "Try" chips and the demo banner; search for "Acme Consulting" returns real fixture brief content instantly (no live provider call); search for an unrecognized name returns `no_results`; Saved shows the frozen Acme Consulting entry; `GET /api/organizer` returns that same frozen entry; `POST`/`DELETE /api/organizer` and `POST /api/comparison` all return 403.
  - Real (non-demo, `role: "standard"`) cookie, as a regression check: home page shows the real company chips (Hindustan Unilever/McKinsey/HDFC Bank) with no demo banner; Saved shows the real empty state ("Nothing bookmarked yet"); `GET /api/organizer` returns a real empty list, not the frozen demo entry. Confirms zero cross-contamination between demo and real sessions.
