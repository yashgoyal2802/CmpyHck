## Context

Session identity today is a single HMAC-signed, unencrypted cookie (`src/lib/auth/session.ts`): `<expiresAt>.<username(base64url)>.<role(base64url)>.<hmac>`. There is no server-side session store — `verifySessionToken` is a pure function of the cookie plus `AUTH_SECRET`. The brief API route (`src/app/api/briefs/route.ts`) calls `getProvider()` (`src/lib/providers/index.ts`), which unconditionally reads `GEMINI_API_KEY` from `process.env`. See proposal.md for why this needs to become per-session for non-admin accounts.

## Goals / Non-Goals

**Goals:**
- Non-admin sessions carry their own Gemini key without any new server-side storage or cleanup.
- Two concurrent sessions on the same account never interfere with each other's key.
- Admin behavior (env key, no key prompt) is unchanged.

**Non-Goals:**
- Validating the submitted key's format or liveness at login time (deferred to first use, via the existing provider-error handling).
- Encrypting the key at rest beyond what the existing signed session cookie already provides.
- Letting a user view, rotate, or clear their key without signing in again.

## Decisions

**Decision: carry the key in the session cookie itself, not a server-side session store.**
The session mechanism is deliberately stateless today (a signing secret is the only server-side state). Introducing a session store (DB table or in-memory map keyed by session id) to hold per-session keys would add TTL/cleanup/concurrency bookkeeping that the two-people-one-account scenario doesn't actually need — each person's browser already holds an independent cookie, so attaching the key to that cookie gets per-session isolation for free and keeps the "no account-record writes" property from the proposal trivially true.
*Alternative considered*: keep a `Map<sessionId, apiKey>` in a serverless function's memory. Rejected — serverless instances aren't guaranteed to be the same process across requests, so a key could vanish mid-session; solving that properly means a database table, which is exactly the complexity this change should avoid.

**Decision: extend the signed payload with a 4th, optional segment, holding the key AES-GCM-encrypted rather than plain base64url.**
`encodePayload`/`decodePayload` already tolerate a variable number of dot-separated segments (a pre-roles 2-segment token still decodes). Add `apiKey` as segment 4, present only for non-admin sessions: `<expiresAt>.<username>.<role>.<encryptedApiKey?>.<hmac>`. Admin tokens keep the existing 3-segment shape.

The key segment is encrypted, not just base64url-encoded like `username`/`role`, so it's unreadable from a raw cookie value alone (e.g. a compromised machine's disk/cookie jar), not merely tamper-evident. Encryption key material is derived from `AUTH_SECRET` via `crypto.subtle.digest("SHA-256", ...)` to get 256 bits, imported as an AES-GCM key; a random 12-byte IV is generated per `createSessionToken` call and stored alongside the ciphertext in the segment (`toBase64Url(iv) + ":" + toBase64Url(ciphertext)`). This uses only Web Crypto APIs already available in `session.ts` (it must stay Edge-compatible), so no new runtime dependency.

The outer HMAC signature still covers the full payload string including this encrypted segment, so tampering with it (e.g. swapping in another session's ciphertext) still invalidates the signature exactly like tampering with username or role does today - encryption and the existing signature are complementary, not a replacement for each other.
*Alternative considered*: a 5th always-present segment (empty string for admin). Rejected as needless churn to every admin token for a value that's always absent.
*Alternative considered*: deriving the AES key from a separate new env var instead of reusing `AUTH_SECRET`. Rejected - introduces a second secret to provision and rotate for a change that should stay low-footprint; `AUTH_SECRET` is already the trust root for session integrity, and SHA-256 gives clean domain separation between its HMAC use and its AES-key use (different derivation, different purpose).

**Decision: treat a non-admin session with no key as equivalent to "not signed in" at the middleware gate.**
This covers the migration case: a non-admin session cookie issued before this change has no key segment. Rather than letting it reach the brief API and fail deep inside provider resolution, `middleware.ts` (which already centralizes every access-control decision, per its own stated rationale) checks for this and redirects/401s exactly like the no-session case, forcing a real re-login where the key field is presented. No separate code path needed in the API route itself.

**Decision: resolve the provider's key at the call site, not inside `getProvider`'s env-only path.**
`getProvider(env)` keeps its current signature and behavior (env-only) for the fake-provider/admin path. Add a sibling that takes an explicit key (`createGeminiProvider({ apiKey, model })` already supports this — it's the one function that needs a new entry point, not new logic). The brief route picks server-env vs session-key based on `session.role === "admin"` before calling it.

**Decision: discard a key submitted by an admin account rather than rejecting it.**
If an admin pastes something into the key field (e.g. muscle memory from a previous non-admin login), silently ignoring it is simpler and friendlier than erroring — the field's `required` attribute is removed for admin, but a stray value shouldn't block a legitimate admin login.

## Risks / Trade-offs

- **[Risk]** Encryption key material is derived from `AUTH_SECRET`, so a leak of `AUTH_SECRET` compromises both session integrity and every in-flight session's Gemini key. → **Mitigation**: accepted - `AUTH_SECRET` leaking is already a total compromise of the session system (anyone could forge any session), so this doesn't introduce a new class of exposure, only extends what that existing secret protects.
- **[Risk]** Session cookie grows by roughly the length of a Gemini key plus the IV and AES-GCM auth tag (~40-60 char key → extra ~80-100 chars once encrypted and base64url-encoded) for non-admin sessions. → **Mitigation**: still far under the ~4KB cookie limit; no action needed.
- **[Trade-off]** Every currently-signed-in non-admin session is forced to re-authenticate after deploy (no key on the old token). → **Mitigation**: deliberate and unavoidable without storing keys server-side; matches how `add-user-roles` treated its own breaking session-shape change — documented here rather than engineered around.

## Migration Plan

1. Ship session/middleware/signin/provider changes together — a non-admin session minted by the old code has no key, and a session minted by the new code is read by the new `decodePayload`, so these aren't independently deployable without a window where one side can't read the other's tokens correctly.
2. On deploy, every non-admin user is signed out on their next request (middleware treats their keyless session as unauthenticated) and must sign in again, now supplying a key. No action needed against the `accounts` table or the database - this is a session-shape change only.
3. No rollback data migration is needed either direction: rolling back simply goes back to ignoring the (now-present) 4th segment, which `decodePayload`'s existing tolerance for extra/missing segments already handles.
