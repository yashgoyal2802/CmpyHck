## Context

See proposal.md for motivation. Relevant current state:

- `Account` (`src/lib/storage/types.ts`) is `{ username, passwordHash }`. `Storage.getAccount` reads it; `verifyCredentials` (`src/lib/auth/credentials.ts`) checks it.
- Sessions are a signed, HMAC'd cookie (`src/lib/auth/session.ts`), carrying only `{ username, expiresAt }`. Verification runs in `src/middleware.ts` (Edge runtime, so Web Crypto only — no Node `crypto`, no Postgres driver call today) and again server-side via `getSessionUser()` (`src/lib/auth/server.ts`).
- `src/middleware.ts`'s `matcher` currently covers `/`, `/organizer`, `/compare`, `/api/briefs/:path*`, `/api/organizer/:path*`, `/api/comparison/:path*` — **not** `/saved`. The check itself is binary: valid session or not, no role awareness.
- `/saved` (`src/app/saved/page.tsx`) reads organizer entries directly via `getStorage().listOrganizerEntries()` server-side; there is no separate `/api/saved` route. Its only API dependency is `/api/organizer` (used by `SavedList.tsx`'s unbookmark action), which is already in the matcher.
- Account provisioning is `scripts/provision-account.mjs`, run directly against Postgres with its own hashing (duplicated from `src/lib/auth/password.ts` so the script has no build dependency).
- Postgres schema changes follow one established pattern across this codebase (`src/lib/storage/postgres.ts`'s `SCHEMA_STATEMENTS`): idempotent, lazily-run DDL, additive-first, no separate migration framework.

## Goals / Non-Goals

**Goals:**
- Three roles, enforced at the actual security boundary (API routes + page routes), not just hidden in the UI.
- No new moving parts beyond what the app already has: no DB lookup added to the Edge middleware path, no new auth mechanism.

**Non-Goals:**
- Any in-app way to view or change an account's role (CLI only, per proposal).
- Immediate propagation of a role change to an already-active session.
- Any permission model beyond three fixed roles.

## Decisions

### 1. Role travels in the signed session cookie, not looked up per request
**Decision**: add `role` to `SessionPayload` (`session.ts`), signed and verified the same way `username` already is.

**Why**: `middleware.ts` runs on the Edge runtime today with zero DB dependency in the auth path — it only verifies an HMAC signature. Looking up role from Postgres per request would either require porting the Neon HTTP driver into middleware (extra latency on every navigation, a new failure mode if the DB is briefly unreachable) or moving the auth check out of middleware entirely (loses the "protected by default" property the codebase explicitly values — see `middleware.ts`'s own comment). Embedding role in the already-signed cookie costs nothing extra and reuses the exact mechanism `username` already proves works at the Edge.

**Alternative considered**: DB lookup in middleware via the Neon serverless (HTTP-based) driver, which *is* Edge-compatible. Rejected for this change's scope — adds a network round-trip to every single navigation for a property (role) that changes rarely, to solve a staleness problem the app already accepts elsewhere (30-day session TTL means even *username* changes wouldn't propagate instantly if usernames were ever mutable).

### 2. `role` is a Postgres `TEXT` + `CHECK` constraint, matching the `status` precedent
**Decision**: `role TEXT NOT NULL DEFAULT 'standard' CHECK (role IN ('admin','standard','search_only'))`, added via `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role TEXT`, then `SET DEFAULT`, then `SET NOT NULL` (trivially satisfied since the default backfills existing rows), then the `CHECK` constraint guarded the same `DO $$ ... EXCEPTION WHEN duplicate_object` way `organizer_entries.status`'s constraint already is.

**Why**: identical reasoning to the organizer status enum's own design decision — a `CHECK` constraint is a plain `DROP`/`ADD CONSTRAINT` if the role set ever needs to grow, unlike a Postgres `ENUM` type.

### 3. Enforcement lives in `middleware.ts`, keyed off route path, not per-page/per-route-handler checks
**Decision**: extend the `matcher` to include `/saved` and the routes `search_only` must be denied, and add a role check after the existing session-validity check: if the verified session's role is `search_only` and the request path isn't the search page (`/`) or `/api/briefs/*`, deny it (redirect for page requests, 403 JSON for API requests — mirroring the existing unauthenticated-request handling).

**Why**: the codebase's own stated rationale for putting auth in middleware ("a new route is protected by default... cannot silently expose it") applies identically to role gating — a per-page `if (role === ...) redirect()` check is exactly the kind of thing a future page could forget to add. One allowlist (what `search_only` *can* reach) is easier to keep correct than N denylists scattered across pages/routes.

**Alternative considered**: gate only the pages, not the API routes, and rely on the UI hiding nav links. Rejected — proposal.md is explicit that page-level gating alone is insufficient since a `search_only` account could call `/api/organizer` or `/api/comparison` directly regardless of what the nav shows.

### 4. `provision-account.mjs` validates `--role` against the same fixed set, defaulting to `standard`
**Decision**: parse `--role <value>` from argv, validate against `['admin','standard','search_only']`, exit with a usage error on an invalid value, default to `'standard'` when the flag is absent.

**Why**: keeps every existing invocation of the script (with no `--role`) working unchanged, satisfying the proposal's backward-compatibility requirement without a separate code path.

## Risks / Trade-offs

- **[Risk]** A role downgrade (e.g. `admin` → `search_only`) does not take effect until that account's next login — someone could retain broader access for up to the remaining session TTL (30 days) after being downgraded. → **Mitigation**: explicitly accepted in the proposal and spec (see the `user-roles` spec's "role change takes effect on next login" requirement); not mitigated further in this change. If this ever matters in practice, a forced-sign-out mechanism is a natural follow-up, deliberately deferred.
- **[Risk]** Forgetting to add a new future route to the middleware `matcher` would leave it reachable by `search_only` (allowlist-by-omission risk, inverted from the current "protected by default" property). → **Mitigation**: none automated in this change; noted here so a future change touching routing is aware of the pattern it must extend.
- **[Trade-off]** Existing accounts silently become `standard` (full access) rather than the most restrictive role. → **Mitigation**: deliberate, per proposal — the alternative (defaulting to `search_only`) would lock out every currently-provisioned account the moment this ships, which is worse than the alternative of an over-broad default for accounts the owner already trusted enough to provision in the first place.

## Migration Plan

1. Deploy the additive `role` column + backfill + constraint (same lazy-DDL-on-first-request pattern as every prior schema change) — no immediate behavior change, since nothing reads `role` yet.
2. Deploy the session/middleware/provisioning-script changes together (they're interdependent: middleware needs `role` in the token, which needs the provisioning script and `getAccount` to produce it). Existing sessions issued before this deploy carry no `role` claim — treat a missing `role` in a decoded session as `standard` (fail open to the pre-existing behavior, not fail closed to `search_only`, since every current session belongs to someone who had full access a moment before this deploy).
3. The owner runs `provision-account -- blackhatghost <password> --role admin` themselves against production, whenever they choose — not part of this deploy.
