## Why

The app currently runs every brief generation against one `GEMINI_API_KEY` from the owner's `.env`, regardless of which account is signed in. Beyond the admin/owner, multiple people share `standard`/`search_only` accounts (e.g. `test1`), so every brief any of them generates burns the owner's free-tier Gemini quota. Letting non-admin accounts supply their own free Gemini key at login moves that cost onto each person using it, without requiring per-person account provisioning.

## What Changes

- **BREAKING**: The sign-in form gains a required Gemini API key field for `standard` and `search_only` accounts. Login SHALL fail without it — username and password alone are no longer sufficient for these roles.
- The `admin` role is exempt: signing in as admin does not ask for or require a key, and admin-driven brief generation keeps using the existing `GEMINI_API_KEY` from `.env`.
- The Gemini key a non-admin user submits at login is held only on their session (not written to the `accounts` table), and is used for that session's brief-generation calls in place of the `.env` key.
- Two concurrent sessions on the same shared account (e.g. two people both signed into `test1` at once with different keys) each use their own submitted key for their own requests — the key travels with the session, not the account, so one session never overwrites or borrows another's key.
- No format/liveness validation of the submitted key beyond "non-empty" — an invalid key simply surfaces as the existing provider-rejection error on first use (`not_configured` / 401/403 handling already in `translateGeminiError`).

## Capabilities

### New Capabilities
- `session-gemini-key`: Collecting a required Gemini API key at login for non-admin accounts, carrying it on the session rather than the account record, and resolving which key (session-supplied or the server's own) a given request's brief generation should use.

### Modified Capabilities
- `company-preparation-brief`: The research provider's API key is no longer always the server's `GEMINI_API_KEY` — it is resolved per request from the signed-in session (admin: server key; non-admin: session key). Login also gains a new required-field failure mode alongside the existing username/password failure.

## Impact

- `src/app/signin/page.tsx`: new required API key input, server action validates its presence for non-admin roles before calling `verifyCredentials`.
- `src/lib/auth/session.ts`: session token payload gains an optional Gemini key claim (present for non-admin sessions only); encode/decode and the HMAC-signed payload format change.
- `src/lib/auth/server.ts` (session start/read helpers) and anywhere the session is read to build a request-scoped provider.
- `src/lib/providers/index.ts` (`getProvider`): needs a variant that accepts an explicit API key (the session's) instead of always reading `env.GEMINI_API_KEY`, used for non-admin requests; admin requests keep calling it as today.
- `src/app/api/briefs/route.ts` (and any other route invoking the provider, e.g. comparison/organizer if they trigger brief generation): resolve the provider using the signed-in session rather than unconditionally from env.
- Session cookie size grows slightly (carries an API key); no database/schema changes, since the key is intentionally never persisted.
