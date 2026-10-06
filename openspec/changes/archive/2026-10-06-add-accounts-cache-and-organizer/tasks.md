## 1. Storage Foundation

- [x] 1.1 Choose and provision a hosted, serverless-compatible database (see design.md Open Questions) and document the choice
- [x] 1.2 Define a storage interface decoupling the pipeline, auth, and organizer from the specific database, mirroring the existing `BriefProvider` seam
- [x] 1.3 Define the accounts schema: username, hashed password
- [x] 1.4 Define the company cache schema: company key, overview, classification, deep-dive content, 4P (nullable), cached-origin sources, last-seen news snapshot, cached-at timestamp
- [x] 1.5 Define the organizer schema: user reference, company reference, prepped status, interview date (nullable), confidence rating

## 2. User Accounts

- [x] 2.1 Extend the session token payload to carry a username claim, signed the same way as today's expiry-only token
- [x] 2.2 Implement credential verification: hash the submitted password and compare against the stored hash for the given username
- [x] 2.3 Add an owner-facing way to provision accounts (script or minimal internal tool) - no self-service signup route
- [x] 2.4 Replace the passphrase sign-in form with a username and password form
- [x] 2.5 Update middleware and the brief API route to resolve the authenticated username from the session rather than a boolean
- [x] 2.6 Remove the passphrase verification path and the `ACCESS_PASSPHRASE` env var

## 3. Company Research Cache

- [x] 3.1 Add a cache lookup keyed on the normalized/resolved company name at the start of the pipeline, before research
- [x] 3.2 Implement the origin-prefixed source id scheme (`c1, c2, ...` for cached sources, `n1, n2, ...` for fresh sources) so merged citations never collide
- [x] 3.3 On a cache hit, run a news-focused research call instead of full research
- [x] 3.4 On a cache hit, pass the cached overview/deep-dive/4P to structuring as established context; generate only news, talking points, and interviewer questions
- [x] 3.5 On a cache miss or expired entry, run full research and structuring as today, then write the resulting stable facts and their sources to the cache
- [x] 3.6 Implement a configurable cache TTL with a sane default; treat an entry past its TTL as a miss
- [x] 3.7 Add a manual "force refresh" action that bypasses the cache regardless of TTL

## 4. What's Changed

- [x] 4.1 Store a last-seen news snapshot per cached company, used only for diffing - never served as current news
- [x] 4.2 Compute the diff between the last-seen snapshot and freshly fetched news on a cache hit
- [x] 4.3 Render a "what's new since you last checked" section when the diff is non-empty, and an explicit "nothing new" state when it is empty

## 5. Personal Organizer

- [x] 5.1 Implement organizer entry storage scoped to (user, company): prepped status, interview date, confidence
- [x] 5.2 Add UI to mark a company prepped/not, set an interview date, and set a confidence rating
- [x] 5.3 Add an organizer overview listing the signed-in user's tracked companies with their status
- [x] 5.4 Ensure organizer entries reference shared company research by key rather than duplicating it

## 6. Company Comparison

- [x] 6.1 Add a UI for selecting two or three companies to compare
- [x] 6.2 Run the pipeline independently per selected company, reusing cache exactly as a standalone search would
- [x] 6.3 Render the resulting briefs side by side
- [x] 6.4 Handle one company's research failing without blocking the others; show it as unavailable in place

## 7. Verification

- [x] 7.1 Add tests for login: correct credentials admitted, incorrect denied, no accounts provisioned denies all
- [x] 7.2 Add tests for sessions: correctly identifies the authenticated user, tampered or expired session rejected
- [x] 7.3 Add tests confirming passwords are never stored or logged in plain text
- [x] 7.4 Add tests for a cache hit reusing stable facts without re-researching them
- [x] 7.5 Add tests for a cache miss or expired entry triggering full re-research
- [x] 7.6 Add tests confirming news is always fetched fresh regardless of cache hit
- [x] 7.7 Add tests confirming cached-origin and fresh-origin citation ids never collide and both resolve correctly
- [x] 7.8 Add tests for the "what's changed" diff, including the nothing-new case
- [x] 7.9 Add tests confirming the cache is shared across different users
- [x] 7.10 Add tests confirming organizer entries are private - one user cannot see another's
- [x] 7.11 Add tests for organizer status/date/confidence tracked independently per user per company
- [x] 7.12 Add tests for comparison rejecting fewer than two or more than three companies
- [x] 7.13 Add tests for comparison reusing cache per company exactly as a standalone search would
- [x] 7.14 Add tests confirming one company's comparison failure does not block the others
- [x] 7.15 Run the app locally and verify: login, a cache-cold search, a cache-warm repeat search showing what changed, an organizer entry, and a three-company comparison

## 8. Migration & Deployment

- [x] 8.1 Communicate the breaking auth cutover to existing users before deploying - new credentials required, the passphrase stops working (confirmed: solo user, no one else to notify)
- [x] 8.2 Provision the hosted database in the deployment environment (Vercel Neon integration; DATABASE_URL already set in production)
- [x] 8.3 Provision the 3-4 accounts (1 account provisioned against production DB; more can be added anytime with `npm run provision-account`)
- [x] 8.4 Remove `ACCESS_PASSPHRASE` from deployment configuration
- [x] 8.5 Deploy and verify login, cache behavior, the organizer, and comparison on the deployed instance
