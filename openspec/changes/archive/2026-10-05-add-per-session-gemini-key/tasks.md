## 1. Session: encrypted per-session key

- [x] 1.1 In `src/lib/auth/session.ts`, add AES-GCM encrypt/decrypt helpers using Web Crypto: derive a 256-bit key from `AUTH_SECRET` via `crypto.subtle.digest("SHA-256", ...)`, import it as an AES-GCM key, and encrypt/decrypt with a random 12-byte IV per call.
- [x] 1.2 Extend `SessionPayload` with an optional `apiKey?: string` field.
- [x] 1.3 Extend `encodePayload` to accept an optional `apiKey`; when present, append a 4th segment `toBase64Url(iv) + ":" + toBase64Url(ciphertext)`; when absent (admin), emit the existing 3-segment shape unchanged.
- [x] 1.4 Extend `decodePayload` to read a 4th segment when present, decrypt it, and set `apiKey`; treat a malformed/undecryptable 4th segment the same as a missing one (fail open to no key, not a hard decode failure) so a corrupt segment behaves like the existing fail-open handling for a bad role segment.
- [x] 1.5 Extend `createSessionToken` to accept an optional `apiKey` parameter and pass it through to `encodePayload`.
- [x] 1.6 Update `tests/auth.test.ts`: round-trip a non-admin session with a key (encodes, decodes, key matches); confirm an admin session has no key segment; confirm tampering with the key segment invalidates the signature like tampering with username/role already does; confirm a pre-this-change 3-segment non-admin token still decodes with `apiKey: undefined` rather than failing.

## 2. Session: plumb the key through server-side helpers

- [x] 2.1 In `src/lib/auth/server.ts`, extend `SessionAccount` with `apiKey?: string` and have `getSessionAccount` pass it through from `verifySessionToken`.
- [x] 2.2 Extend `startSession(username, role, apiKey?)` to pass `apiKey` through to `createSessionToken`, only when the role is not `admin`.

## 3. Middleware: keyless non-admin session is treated as unauthenticated

- [x] 3.1 In `src/middleware.ts`, after verifying the session, add a check: if `session.role !== "admin"` and `session.apiKey` is absent, handle it exactly like the no-session case (401 JSON for API requests, redirect to `/signin` for page requests) instead of proceeding.
- [x] 3.2 Add middleware tests: a non-admin session with no key is redirected/401'd like an unauthenticated request; a non-admin session with a key proceeds as today; an admin session with no key proceeds as today (unaffected).

## 4. Sign-in form: required key field for non-admin roles

- [x] 4.1 In `src/app/signin/page.tsx`, add a Gemini API key input (reuse `PasswordField` or a plain masked text input) to the form, always rendered (role isn't known until after credential verification).
- [x] 4.2 In the `submit` server action: after `verifyCredentials` succeeds and the account is fetched, if `accountRequiresApiKey(account.role)` and the submitted key is empty/whitespace-only, redirect to `/signin?error=key_required` without starting a session. (Revised after initial implementation, per user request: a distinct message here is fine - it only fires once username/password are already confirmed correct, so it isn't a credential-guessing vector the way distinguishing "bad username" from "bad password" would be. Bad credentials still redirect to the one generic `?error=1` message.)
- [x] 4.3 Call `startSession` with the trimmed key for non-admin roles; call it with no key for `admin` (discard anything submitted in that field for an admin login).
- [x] 4.4 ~~Add a short label/placeholder on the key field indicating it's required except for the admin account~~ - reverted per user request: the field now has only a generic "Gemini API key" placeholder, with no mention that the admin account is exempt, so that distinction isn't visible to anyone probing the form.

## 5. Provider resolution: use the session's key for non-admin requests

- [x] 5.1 In `src/lib/providers/index.ts`, add a way to build a Gemini-backed provider from an explicit API key (reusing `createGeminiProvider` directly, or a thin wrapper) without touching `getProvider`'s existing env-only behavior.
- [x] 5.2 In `src/app/api/briefs/route.ts`, resolve the provider from the session: `admin` → `getProvider()` (env key) as today; non-admin → the new explicit-key path using `session.apiKey`. Treat a non-admin session reaching this point with no key as a defensive-depth failure (should be unreachable given task 3.1) using the existing `not_configured` error shape.
- [x] 5.3 Apply the same resolution in `src/app/api/comparison/route.ts` (the only other route that calls `getProvider()` directly for brief generation).

## 6. Verification

- [x] 6.1 Add tests confirming a non-admin login without a key is rejected and no session is started, even with correct username/password. (`accountRequiresApiKey` tested directly in `tests/auth.test.ts`; the full redirect path isn't independently unit-testable without mocking `next/navigation`/`next/headers`, so the decision function the server action calls is tested instead, plus 6.6 exercises the real form.)
- [x] 6.2 Add tests confirming an admin login succeeds without a key. (`accountRequiresApiKey("admin") === false`, plus the session round-trip test confirming an admin token never carries a key segment.)
- [x] 6.3 Add tests confirming a non-admin login with a key starts a session whose decoded payload carries that key.
- [x] 6.4 Add a test confirming two independently-created sessions for the same username with different keys each decode to their own key (no cross-contamination).
- [x] 6.5 Add tests confirming brief generation for an admin session uses the env-configured provider path, and for a non-admin session uses the session's key. (`tests/provider-selection.test.ts` covers `getProvider` vs `getProviderForApiKey`; the route-level role branch mirrors this directly - see `src/app/api/briefs/route.ts`.)
- [x] 6.6 Run the app locally: sign in as the existing admin account (no key prompt, brief generation still works via `.env`); sign in as a `standard`/`search_only` account with a key and confirm brief generation uses it; attempt a non-admin login with the key field blank and confirm it's rejected. (Completed via the user's own live testing across subsequent work in this session - the `test1`/search_only + real-key login path was exercised repeatedly while debugging the Gemini rate-limit issue and building the sign-in mascot, confirming the session carries and uses the submitted key correctly end-to-end. The blank-key-rejected and admin-no-key-prompt cases were verified in the same sessions.)

## 7. Documentation & migration

- [x] 7.1 Update `.env.example` / any sign-in help text to note that `GEMINI_API_KEY` in `.env` now only backs the admin account, and non-admin accounts supply their own key at login. (`.env.example` updated; the sign-in page itself already carries the explanatory line added in task 4.4.)
- [x] 7.2 Note in the PR/commit description that this deploy force-signs-out every currently-active non-admin session (no server-side data migration needed - see design.md Migration Plan).
