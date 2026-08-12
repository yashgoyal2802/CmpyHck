## Why

Every provisioned account today has identical access to the whole app. As more people are provisioned, the owner wants to hand out narrower access (e.g. someone who should only be able to look up companies) without giving them the personal organizer, comparison tool, or saved list, and wants a clear "this is the owner account" designation. This is scoped intentionally small: three fixed roles, no in-app user-management UI, reusing the existing CLI-provisioning and session mechanisms rather than adding new ones.

## What Changes

- Every account now has a `role`: `admin`, `standard`, or `search_only`. **BREAKING**: existing accounts (which have no role today) are backfilled to `standard` so nobody already provisioned loses access.
- `scripts/provision-account.mjs` gains an optional `--role <admin|standard|search_only>` flag, defaulting to `standard` when omitted, so existing invocations keep working unchanged. Account creation stays exactly as it is today — the owner running this script directly against the database. There is no in-app admin UI or user-management route in this change.
- The signed session cookie carries `role` alongside the existing `username` claim. A role change (re-running the provisioning script with a new `--role`) takes effect on that account's next login, not immediately — the same staleness tradeoff the session already accepts for a 30-day TTL.
- A `search_only` account can only reach the home/search page (search a company, read/copy its brief). The Organizer, Compare, and Saved pages — and their underlying API routes — are denied to that role. `admin` and `standard` both retain full access to everything that exists today; this change does not add any admin-only capability yet.
- `AppHeader`'s nav only renders the Search tab for a `search_only` user, matching the enforced access (the middleware/API gating is the actual boundary; this is cosmetic consistency, not enforcement).

## Capabilities

### New Capabilities
- `user-roles`: a fixed three-role model (`admin`, `standard`, `search_only`) that determines which pages and API routes an account can reach.

### Modified Capabilities
- `user-accounts`: provisioned accounts now carry a role, set at provisioning time and carried in the session alongside the existing username identity.

## Impact

- **Data model / storage**: `src/lib/storage/types.ts` (`Account` gains `role`), `postgres.ts` (additive `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role ...` + backfill, same idempotent lazy-DDL pattern as every prior schema change), `memory.ts`.
- **Provisioning**: `scripts/provision-account.mjs` (new `--role` flag).
- **Session**: `src/lib/auth/session.ts` (`SessionPayload` gains `role`, encode/decode/create/verify all updated), `src/lib/auth/server.ts` (expose role alongside `getSessionUser`).
- **Access enforcement**: `src/middleware.ts` (route gating becomes role-aware, not just "is authenticated"; matcher needs to cover `/organizer`, `/compare`, `/saved`, and their API routes for `search_only` denial — `/saved` and its data path are not currently in the matcher at all).
- **UI**: `src/components/AppHeader.tsx` (nav items conditional on role).
- **Explicitly out of scope**: any in-app admin/user-management UI, any per-user API key feature, any forced sign-out on role change, any permission model finer than these three roles.
