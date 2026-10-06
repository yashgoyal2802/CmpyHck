## Why

Right now the only way to see what the app actually looks like is to have a provisioned account — there's no way for a prospective user (or the owner, showing it to someone) to browse the UI without going through account provisioning first. A frictionless, zero-commitment "have a look" path lowers the barrier to someone deciding whether to ask for a real account, at essentially no cost: it never touches a real research provider or the database.

## What Changes

- A "Have a look" entry point on the sign-in page starts a **demo session** with no form, no credentials, and no account created anywhere — a session cookie carrying an `isDemo` flag, never written to the `accounts` table.
- A demo session can reach every page a real account can (search, saved, organizer, compare) — nothing is redirected away — but:
  - **Search** only resolves against the existing fixture companies in `src/fixtures/briefs.ts` via the existing fake provider, never a real Gemini/OpenRouter call. An unrecognized name shows the existing "no results" state.
  - The homepage's "TRY" suggestion chips show fixture company names instead of the real ones, so a demo visitor isn't guessing what's searchable.
  - **Saved** is frozen: always shows one pre-selected fixture company already bookmarked, demonstrating the save/saved-list loop without real organizer storage.
  - **Compare** and **Organizer** render their normal page, but every action control (compare, save, bookmark, status/date/confidence edits) is disabled with a "sign in to use this" nudge, enforced at both the UI (disabled controls) and the API routes (reject the write) — the same defence-in-depth pattern the app already uses elsewhere.
- A persistent "You're browsing a demo" banner/indicator is visible throughout a demo session, with a clear path to the real sign-in page.
- **BREAKING for nothing existing**: this is purely additive — no change to any existing account, role, or auth behavior for real sessions.

## Capabilities

### New Capabilities
- `demo-mode`: a credential-free, read-mostly way to browse the app's UI and a fixture-backed search experience, with no real provider calls, no database writes, and no real account created. Includes the demo session's explicit exemption from the existing (previously un-spec'd) middleware rule that a non-admin session without a Gemini key is treated as unauthenticated — a demo session is non-admin but legitimately never carries one.

### Modified Capabilities
(none — the middleware behavior being exempted isn't itself captured as an existing requirement anywhere, so there's nothing to modify; the exemption is specified fresh as part of `demo-mode` above.)

## Impact

- `src/app/signin/page.tsx`: new "Have a look" control alongside the existing form, wired to a server action that starts a demo session.
- `src/lib/auth/session.ts` / `src/lib/auth/server.ts`: session payload gains an `isDemo` flag; `startSession`/session-reading helpers thread it through. Not a new `AccountRole` — orthogonal to the existing admin/standard/search_only enum, and never persisted to `accounts`.
- `src/middleware.ts`: the existing "non-admin session with no key = treated as unauthenticated" check gets an explicit demo exception.
- `src/app/page.tsx`, `src/app/saved/page.tsx`, `src/app/compare/page.tsx`, `src/app/organizer/page.tsx`: each already does its own `getSessionAccount()` + redirect; each now branches on `isDemo` to serve fixture/frozen content instead of real storage/provider calls.
- `src/components/AppHeader.tsx`: nav visibility and the account menu need a demo-aware presentation (no real username to show, "sign in" instead of "sign out").
- `src/components/OrganizerBoard.tsx`, `src/components/ComparisonWorkspace.tsx`, `src/components/SavedList.tsx` (or wherever their action controls live): disabled state + CTA when `isDemo`.
- `src/app/api/organizer/route.ts`, `src/app/api/comparison/route.ts`: reject writes from a demo session server-side, independent of the UI.
- `src/lib/providers/index.ts` or the `briefs`/comparison routes: demo sessions resolve to the fake provider (fixture-backed), never `getProvider()`/`getProviderForApiKey()`.
- No database schema change, no new environment variables.
