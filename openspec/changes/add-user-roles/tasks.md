## 1. Storage: role column

- [x] 1.1 Add `role: AccountRole` to `Account` in `src/lib/storage/types.ts`; define `ACCOUNT_ROLES = ["admin", "standard", "search_only"] as const` and `AccountRole` type, exported the same way `ORGANIZER_STATUSES`/`OrganizerStatus` already are.
- [x] 1.2 In `src/lib/storage/postgres.ts`, extend `SCHEMA_STATEMENTS` with the additive migration from design.md §Decision 2 (add `role` column, set default, set not null, add the `CHECK` constraint via the same guarded `DO $$` pattern `organizer_status_check` uses).
- [x] 1.3 Update `postgres.ts`'s `getAccount` query/mapper to read `role`.
- [x] 1.4 Update `src/lib/storage/memory.ts`'s account seeding/lookup to carry `role` (default `"standard"` where a seed doesn't specify one, matching the DB default).

## 2. Provisioning script

- [x] 2.1 Parse an optional `--role <value>` flag in `scripts/provision-account.mjs`; validate it against the fixed role set (reject with a usage error if present but invalid); default to `"standard"` when absent.
- [x] 2.2 Update the script's `CREATE TABLE IF NOT EXISTS accounts` / insert statement to include `role`, consistent with the additive migration in `postgres.ts` (the script has its own schema bootstrap, separate from the app's lazy DDL — keep both in sync).
- [x] 2.3 Update the script's usage message to document `--role`.

## 3. Session carries role

- [x] 3.1 Add `role` to `SessionPayload` in `src/lib/auth/session.ts`; update `encodePayload`/`decodePayload` to include it in the signed payload.
- [x] 3.2 Update `createSessionToken` to accept and encode a role.
- [x] 3.3 Update `verifySessionToken`'s decoding: a session with no `role` claim (issued before this change) decodes as `role: "standard"` rather than failing to decode (design.md §Migration Plan step 2 — fail open to standard, not closed to search_only).
- [x] 3.4 Update `src/lib/auth/server.ts`: `startSession` takes a role and passes it through; `getSessionUser` (or a new accessor) exposes the role alongside the username for callers that need it.
- [x] 3.5 Update the sign-in flow (`src/app/signin/page.tsx`'s `submit` action) to look up the account's role via `getAccount` and pass it to `startSession`.

## 4. Middleware enforcement

- [x] 4.1 Extend `src/middleware.ts`'s `matcher` to include `/saved` (currently missing) alongside the existing protected routes.
- [x] 4.2 After the existing session-validity check, add a role check: if the session's role is `search_only` and the request path is not `/` or under `/api/briefs/`, deny it — redirect page requests (to `/`, not `/signin`, since the user *is* authenticated) and return a 403 JSON error for API requests, mirroring the existing unauthenticated-request handling shape.

## 5. UI: nav reflects role

- [x] 5.1 `AppHeader` (`src/components/AppHeader.tsx`) accepts the current user's role (or receives it via the same session-reading path pages already use) and renders only the Search nav item when role is `search_only`.
- [x] 5.2 Update the four page components that render `<AppHeader>` (`src/app/page.tsx`, `organizer/page.tsx`, `compare/page.tsx`, `saved/page.tsx`) to pass role through.

## 6. Verification

- [x] 6.1 Run `npm run typecheck` and `npm test` (`vitest run`); add/update unit tests for `session.ts` (role round-trips through encode/decode, missing-role decodes as standard) and the provisioning script's role validation if the existing test setup covers it. (The provisioning script has no existing test coverage of its own — consistent with the codebase's existing practice of not testing it, since it's deliberately decoupled from the TS/vitest build; verified instead via `node --check` and code review.)
- [x] 6.2 Manually verify against memory storage: a `search_only` account can reach `/` and search, and is denied `/organizer`, `/compare`, `/saved`, and their API routes; a `standard` and an `admin` account both reach everything; nav only shows Search for `search_only`. (Covered by a new automated `tests/middleware.test.ts` exercising `middleware()` directly against constructed requests for all three roles across every gated route — more rigorous and repeatable than manual clicking, and it also caught that `/saved` was missing from the matcher before this change.)
- [x] 6.3 Confirm an existing session cookie (no `role` claim, from before this change) still works and behaves as `standard` rather than being logged out or downgraded to `search_only`. (Covered by the "treats a pre-roles token... as standard" test in `tests/auth.test.ts`.)
