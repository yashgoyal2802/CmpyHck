## Context

See `proposal.md` for motivation. This is the first change to introduce server-side persistence into an application that has none today - `build-placement-company-research-app` generates every brief fresh, on every request, with nothing stored between requests.

The deployment target is Vercel (serverless functions). This rules out a local SQLite file as the store: serverless functions do not guarantee a persistent local disk across invocations, so anything meant to survive between requests must live in a hosted database reachable over the network, not on-disk.

The existing brief pipeline is `normalize -> research (grounded) -> plan sections -> structure -> assemble`, implemented behind a `BriefProvider` seam (`src/lib/providers/`). Source references use per-brief, positionally-assigned ids (`s1`, `s2`, ...) that `assembleBrief` validates every citation against, downgrading any claim whose citation does not resolve from `sourced` to `inferred`. This validation is why caching needs a specific answer for how citations survive a cache hit (see Decisions).

Auth today is a single shared passphrase exchanged for a signed, expiring session cookie (`src/lib/auth/session.ts`, `src/middleware.ts`). The cookie carries no identity, just "authorized: true/false."

## Goals / Non-Goals

**Goals:**

- Give each of the 3-4 users their own login, without an external identity provider.
- Avoid re-researching a company's stable facts on every repeat search.
- Keep news always freshly fetched - caching must never serve stale news as current.
- Make cached-fact citations behave identically to fresh ones under the existing citation-validity enforcement in `assembleBrief`.
- Give each user a private view of which companies they have prepped.
- Let a user view 2-3 companies side by side.

**Non-Goals:**

- Self-service account registration or password reset. The owner provisions accounts and resets passwords by hand, the same way the passphrase was shared and rotated.
- Free-text personal notes in the organizer. This change covers structured status (prepped/not), an interview date, and a confidence rating only. Rich note-taking is a larger, separate problem (storage shape, editing UX, possibly sharing) and is being deliberately deferred rather than folded in here. **Flagging this for confirmation** - if notes should be in scope now, the organizer's data shape and this change's specs both need to change before implementation starts.
- OAuth or any external identity provider. Superseded reasoning: the original design rejected OAuth because nothing needed identity. That premise no longer holds (the organizer is per-user data), but the conclusion to avoid OAuth still holds - a self-hosted username/password store is enough for 3-4 owner-provisioned accounts and avoids the external setup cost OAuth would add.
- Real-time collaboration or live sync between users' organizers. Each user's data is theirs alone.
- Bulk/batch brief generation. Comparison generates or reuses 2-3 briefs from explicit user action, not an arbitrary shortlist import.

## Decisions

### Extend the existing signed-cookie session rather than adopt a new auth library

The session token already minted by `src/lib/auth/session.ts` is a signed, expiring payload. Today that payload is just an expiry timestamp. It becomes an expiry timestamp plus a username claim, signed the same way. Middleware, the gate on `/api/briefs`, and the cookie mechanics are unchanged; only the payload contents and what gets checked against a credentials table (username + hashed password) instead of a single shared secret.

Password storage: hashed (not reversibly encrypted, not plaintext), using a standard slow hash. This is a floor worth holding even at 4 accounts - hashing is not extra complexity proportional to user count.

Alternatives considered:

- OAuth (Google): rejected again, see Non-Goals.
- A third-party auth-as-a-service product: unnecessary infrastructure for 3-4 owner-provisioned accounts; the existing session module already does 90% of the work.

### Two-layer data model: shared cache vs. private user data

Everything persisted splits cleanly into two categories that must not be conflated:

```
SHARED (no privacy boundary)          PRIVATE (scoped to one user)
-----------------------------          -----------------------------
company research cache                 organizer entries
  overview, classification,              (status, interview date,
  deep-dive topics, 4P                    confidence) per company
  + the sources that back them         user credentials
```

A company's overview is not anyone's secret; every user reads the same cached row. An organizer entry is specific to one person's preparation and is never visible to another account. These are different tables with different access rules, not one "user data" blob.

### Cache what is stable; never cache news; keep a last-seen news snapshot only for diffing

Cached per company (keyed on the normalized/resolved company name): `overview`, `classification`, `deepDive` (topics, heading, sector), `fourP` (nullable), the `sources` that back those specific claims, and a `cachedAt` timestamp.

Not treated as authoritative cache: `news`, `talkingPoints`, `interviewerQuestions`. News is re-fetched fresh on every search, by definition - a cached "recent" item stops being recent. Talking points and interviewer questions are syntheses over both the stable facts and the news, so they are regenerated on every request (cheaply, from cached facts + fresh news) rather than persisted.

One narrow exception: the news items shown on the *previous* search are kept as a lightweight "last-seen" snapshot, used only to compute the "what's changed" diff. This snapshot is never served as if it were current news - it exists purely so a repeat search can say what's new since last time.

TTL: cached stable facts expire after a configurable period (default proposed: 30 days) and are re-researched in full on expiry, same as a cold cache miss. A manual "force refresh" is the user-facing escape hatch for "this looks stale, re-check now" before the TTL lapses.

Alternatives considered:

- Cache everything including news: defeats the purpose of "recent news" and risks presenting stale news as current, which the MVP's spec explicitly treats as a fabrication-adjacent failure mode.
- No TTL, cache forever until manually refreshed: simpler, but risks a stale brief silently going unnoticed for months; a default expiry is a safer default with an opt-out via forced refresh.

### Citation ids get an origin-scoped prefix so cached and fresh sources never collide

`assembleBrief` already validates every claim's `sourceIds` against the brief's resolved `sources` list and downgrades an unresolvable citation from `sourced` to `inferred`. On a cache hit, sources come from two batches - the ones cached alongside the stable facts, and the fresh ones backing this request's news - and both must resolve correctly against the same validation.

Resolution: source ids are prefixed by origin instead of being a flat per-brief sequence - `c1, c2, ...` for cached-origin sources, `n1, n2, ...` for this request's fresh sources. The two id spaces can never collide, `assembleBrief`'s existing validation logic needs no change, and a cached claim's citations keep resolving correctly indefinitely, across however many repeat searches read that cache row.

Alternatives considered:

- Re-number all sources per request as today (`s1, s2, ...`): would require rewriting the `sourceIds` stored on every cached claim on every read to match the new numbering, or accept collisions between cached and fresh ids referring to different sources. Both are worse than a stable prefix scheme.

### Pipeline gains a cache check between normalize and research

```
today:     normalize -> research -> plan -> structure -> assemble

with       normalize -> cache lookup
cache:                     |
                    hit (fresh)         miss / expired
                       |                     |
                 news-only research    full research (as today)
                 (grounded, scoped         |
                  to recent news)      write stable facts +
                       |               their sources to cache
                       +-------+-------+
                               |
                       plan (from cached or
                       fresh classification)
                               |
                       structure (cached facts
                       as given context; generate
                       news, talking points,
                       interviewer questions)
                               |
                           assemble
```

On a cache hit, the structuring call is told the overview/deep-dive/4P text as established context rather than asked to reproduce it, and only needs to produce the news items and the two synthesized sections. This is where most of the token saving comes from - not skipping structuring entirely, but giving it far less to generate.

### Comparison reuses the single-company pipeline; it is not a new generation path

Comparing 2-3 companies runs the existing (now cache-aware) pipeline once per company and renders the results side by side. No new research or generation logic - a presentation-layer feature over an unchanged pipeline, made cheaper by whichever of the compared companies already have a warm cache entry.

## Risks / Trade-offs

- Auth is a breaking change -> every existing session becomes invalid the moment this ships; users must get their new credentials and log in again. Communicate this before deploying rather than letting it surface as a confusing lockout.
- Real personal data now exists (organizer entries) -> unlike the MVP, this cannot be casually reverted once users have entered data; a rollback plan needs to account for data, not just code.
- Cache staleness -> a cached brief could miss something that happened within the TTL window. Mitigated by keeping the TTL modest (default 30 days) and offering a manual force-refresh.
- Two source-id namespaces add a small amount of conceptual overhead to the assembly code -> contained entirely inside cache-read/merge logic; `assembleBrief`'s validation itself does not change.
- A hosted database is a new operational dependency and a new free-tier limit to track, on top of the Gemini free tier already in play -> choose a provider with a free tier comfortably above this app's scale (see Open Questions).

## Migration Plan

1. Add the storage layer (accounts, cache, organizer tables) behind a small storage interface, mirroring how `BriefProvider` decouples the pipeline from a specific vendor.
2. Add username/password auth alongside the existing passphrase gate, provision the 3-4 accounts, verify login end to end.
3. Cut over: remove the passphrase path, retire `ACCESS_PASSPHRASE`. This is the breaking point - communicate it before deploying.
4. Add the cache read/write path to the pipeline, with the origin-prefixed source ids.
5. Add the "what's changed" diff view.
6. Add the personal organizer UI and its private data path.
7. Add the comparison view.
8. Rollback: reverting the auth cutover after users have entered organizer data would orphan that data behind accounts that no longer exist - if rollback is needed after step 6, plan to preserve or export organizer data first, not just revert code.

## Open Questions

- Which hosted database/provider to use (e.g., a Postgres-compatible free tier on Vercel, or a SQLite-compatible edge store). Deferred because the storage interface (step 1 above) makes this swappable without touching the pipeline, specs, or task breakdown - same pattern as the `BriefProvider` seam.
- Exact cache TTL duration (30 days proposed). A tunable, not an architectural choice; safe to pick a value during implementation and adjust based on real usage.
