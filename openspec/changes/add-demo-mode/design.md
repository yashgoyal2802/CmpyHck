## Context

See proposal.md for motivation. Relevant current shape:

- Every gated page (`src/app/page.tsx`, `saved/page.tsx`, `compare/page.tsx`, `organizer/page.tsx`) independently calls `getSessionAccount()` and redirects to `/signin` if null — middleware gates the route first, the page re-checks as defence in depth.
- `src/middleware.ts` already has a non-admin-specific rule: a session whose role isn't `admin` and carries no `apiKey` is treated exactly like no session at all (forces re-login) — added for `add-per-session-gemini-key`. This is the rule a demo session must be explicitly exempted from, or it never gets past middleware.
- The session cookie is a signed, stateless payload (`src/lib/auth/session.ts`): `<expiresAt>.<username>.<role>.<apiKey?>.<hmac>`. `AccountRole` is `"admin" | "standard" | "search_only"` and is validated against a Postgres `CHECK` constraint on the `accounts` table (`src/lib/storage/postgres.ts`) — adding `"demo"` as a fourth enum value would mean a demo session's role has to satisfy that constraint everywhere role is used, for a value that should never reach the database at all.
- `src/app/api/organizer/route.ts` and `comparison/route.ts` authorize by calling `getSessionUser()`, which returns a username string or `null` — **any** valid session with a username passes this check today, real or demo. This is a concrete gap a demo session would otherwise fall through.
- `getProvider(env)` (`src/lib/providers/index.ts`) already has a `BRIEF_PROVIDER=fake` branch for local dev, which calls `createFakeProvider({ fallbackToGeneric: true })` — `fallbackToGeneric: true` means an unrecognized company name gets a made-up generic fixture instead of a no-results outcome. That's the opposite of what demo-mode needs (`specs/demo-mode`'s "unrecognized company" scenario requires the real no-results state) — demo mode cannot reuse this branch as-is.

## Goals / Non-Goals

**Goals:**
- A demo session is recognizable everywhere it matters (middleware, pages, API routes) without becoming a fifth thing every future `AccountRole`-keyed piece of code has to remember.
- Zero new database writes, zero new environment variables, zero real provider calls, ever, for a demo session.
- Every write-capable API route defends itself against a demo session directly, not just via the UI being disabled - matching the codebase's existing defence-in-depth posture (middleware gates, then each route/page re-checks).

**Non-Goals:**
- Polished, bespoke demo content (per the explore-phase decision, existing test fixtures are reused as-is; a hand-authored realistic fixture is explicitly deferred).
- Rate limiting or anti-abuse measures beyond what already exists for any unauthenticated-adjacent traffic — a demo session triggers no real provider call and no real write, so the cost of abuse is already near zero; not engineering further protection for a cost that doesn't exist yet.
- Any interaction between demo mode and the self-signup idea discussed earlier - that was explicitly parked, not part of this change.

## Decisions

**Decision: `isDemo` is a boolean flag on the session payload, not a fourth `AccountRole`.**
`AccountRole` is a closed, database-validated enum (`CHECK (role IN ('admin','standard','search_only'))`) representing a real provisioned account. A demo session is not an account at all - it's never written to `accounts`, has no password, has no real username. Adding `"demo"` to that enum would mean teaching every role-keyed code path (the Postgres constraint, `provision-account.mjs`, role-comparison logic in `AppHeader`, `middleware.ts`'s search_only allowlist) about a value that must never actually reach the database. A separate `isDemo: boolean` field keeps `role` meaning exactly what it means today, and a demo session's own `role` stays `"standard"` internally only to satisfy the existing type (never checked by anything - every demo-aware branch checks `isDemo` directly, before any role logic runs).
*Alternative considered*: a fourth role value. Rejected for the reason above - it pollutes a database enum with a value that must never be persisted.

**Decision: demo session data is not read from the signed cookie's `apiKey` slot, and carries no username.**
The existing cookie shape has room for `username`, `role`, and an encrypted `apiKey`. A demo session reuses the shape but with `username` set to a fixed sentinel (e.g. `"__demo__"`) never resolvable to a real account, and no `apiKey` segment at all (consistent with "never needs one"). The sentinel username matters for one reason: every route that writes to storage keys data by username (`storage.putOrganizerEntry({ username, ... })`) - a demo session must never reach those calls at all (see the API-route decision below), but using an obviously-non-real sentinel is a second line of defence against an oversight ever actually writing something keyed by it.

**Decision: middleware exemption is a narrow, explicit check, not a broadened existing one.**
`middleware.ts`'s existing line - `session.role !== "admin" && session.apiKey === undefined` treated as unauthenticated - gets one added clause: `&& !session.isDemo`. This is additive and narrow on purpose: it would be easy to instead loosen the general rule ("no key is fine sometimes"), which would quietly weaken the real security property `add-per-session-gemini-key` added. Spelling out the demo exemption explicitly keeps that property intact for every non-demo session.

**Decision: demo-awareness in organizer/comparison API routes is an explicit new check, not inferred from `getSessionUser()`.**
`getSessionUser()` returns a truthy username for a demo session too (it has *a* username, the sentinel) - the existing `if (!username) return unauthorized()` guard would silently let a demo session through to a real `storage.putOrganizerEntry()` call. Both routes need an explicit `if (session.isDemo) return demoRejected()` branch (own response, since the existing `unauthorized()` 401 implies "you need to sign in" which isn't quite right for someone already in an active demo session - a 403 with "Sign in to use this" fits the UX better and matches how `search_only`'s middleware rejection already distinguishes 401 unauthenticated from 403 forbidden-but-authenticated).

**Decision: demo search uses a dedicated fake-provider instance, not the existing `BRIEF_PROVIDER=fake` branch.**
`getProvider()`'s fake branch passes `fallbackToGeneric: true`, which fabricates a generic brief for any unrecognized name - exactly the behavior `specs/demo-mode` rules out (an unrecognized name must show the existing no-results outcome). The `/api/briefs` route resolves the provider as `createFakeProvider({ fallbackToGeneric: false })` (or simply omits the option, since `false` is the default) directly when `session.isDemo`, bypassing `getProvider()`/`getProviderForApiKey()` entirely for that branch.

**Decision: disabled-state UI and API rejection both exist; neither substitutes for the other.**
Per `specs/demo-mode`'s two scenarios (UI shows disabled controls; API rejects the request independent of the UI) - this mirrors the pattern already used for `search_only` (cosmetic nav hiding in `AppHeader` + the real enforcement in `middleware.ts`) and for `/api/briefs` (middleware gates, the route re-checks). Disabling only in the UI would mean a demo session could still POST directly to `/api/organizer`; enforcing only at the API would mean active-looking buttons that silently fail, a worse UX than visibly disabled ones.

## Risks / Trade-offs

- **[Risk]** A future new write-capable route might forget the explicit `isDemo` check, since (unlike middleware's route-level gating) this isn't a single allowlist - it's a per-route decision. → **Mitigation**: none automated in this change; noted here (matching how `add-user-roles`' design.md already flagged the analogous risk for its own allowlist) so a future route author is aware of the pattern to extend.
- **[Risk]** The sentinel demo username (`"__demo__"`) is shared across every concurrent demo visitor. If a bug ever did let a demo session reach `storage.putOrganizerEntry()`, every demo visitor would collide on the same username key. → **Mitigation**: accepted as a secondary defence only - the primary defence (routes reject `isDemo` before any storage call) is what actually prevents this; the sentinel's job is to make such a bug obviously wrong (writes under `"__demo__"`) rather than silently corrupt a real account's data.
- **[Trade-off]** `AppHeader` and `UserMenu` need demo-aware copy (no real username to show, "sign in" instead of "sign out") - a small amount of conditional rendering added to components that were previously always real-account-only. Accepted as unavoidable; the alternative (a separate demo-only header) duplicates far more than it saves.

## Migration Plan

Purely additive - no existing session, account, or route behavior changes for a non-demo session. No database migration. No rollback concern beyond reverting the code, since nothing is persisted.
