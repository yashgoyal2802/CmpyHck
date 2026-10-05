## Context

See proposal.md for motivation. Relevant current shape:

- `BriefProvider` (`src/lib/providers/types.ts`) has four methods: `research`, `structure`, `researchNews`, `structureFromCache`. All four take and return plain, provider-agnostic data (`ResearchResult`, `BriefDraft`, `NewsResearchResult`, `CacheDraft`) — nothing in these shapes names Gemini.
- `src/lib/brief/compare.ts` runs 2-3 `generateBrief()` calls **concurrently** (`Promise.allSettled`) against the **same** `provider` instance passed in from the route. Any design that tracks "which provider just ran" as mutable state on a shared object is unsafe under this concurrency and is rejected below for that reason.
- Prompts (`src/lib/providers/prompts.ts`) are already provider-neutral functions that take data and return strings — reusable by the OpenRouter provider unchanged.
- `src/app/api/briefs/route.ts` and `src/app/api/comparison/route.ts` each resolve a provider once per request today: `getProvider()` for admin, `getProviderForApiKey(session.apiKey)` for everyone else (per `add-per-session-gemini-key`).
- Errors across the app are normalized to one `BriefError` shape (`src/lib/brief/errors.ts`) with a fixed `BriefErrorKind` union; this is what "infrastructure-class vs content-class" below is built on — no new error taxonomy needed.

## Goals / Non-Goals

**Goals:**
- A request that would fail today due to Gemini infrastructure trouble instead quietly succeeds via OpenRouter.
- Zero changes to `pipeline.ts`, `assemble.ts`, `plan.ts`, or any component beyond the new label — the fallback lives entirely behind the `BriefProvider` seam, as `docs/fallback-provider.md` intended.
- Safe under `compareCompanies()`'s concurrent use of one shared provider instance.
- Fallback is additive infrastructure: absent its env vars, behavior is bit-for-bit what it is today.

**Non-Goals:**
- Full citation fidelity parity with Gemini's span-level grounding — `docs/fallback-provider.md` already accepts URL-level attribution as a known regression for the fallback path.
- Picking a specific OpenRouter model with confidence baked into code — model availability on free tiers changes faster than this document can track (this project just spent a long debugging session on exactly that mistake with Gemini model names). `OPENROUTER_MODEL` is a required env var with no hardcoded default; see Open Questions.
- A retry budget beyond one fallback attempt — if both providers fail, the request fails. No queuing, backoff-and-retry-the-same-provider, or third provider.

## Decisions

**Decision: the fallback decision is per-method-call and stateless, not per-`generateBrief()`-request.**
A `FallbackProvider` wraps a primary and a fallback `BriefProvider`. Each of its four methods independently tries primary, and on an infrastructure-class `BriefError` retries the same call via fallback. This is safe under `compareCompanies()`'s concurrent shared-instance usage because no state is mutated on the wrapper itself — the decision and its result live entirely in that call's own stack, not in shared fields.
*Alternative considered*: decide once per `generateBrief()` invocation (try the whole pipeline on primary; on failure, re-run entirely on fallback). Rejected — `generateBrief()` doesn't know about fallback at all today and shouldn't need to; making the wrapper itself the unit of retry means zero changes to `pipeline.ts`, exactly matching the proposal's impact statement and the original doc's design intent.
*Consequence accepted*: in principle `research()` could succeed on Gemini while `structure()` falls back to OpenRouter for the same request. This is safe by construction — `StructureRequest.research` is the plain `ResearchResult` type, not a Gemini-specific shape — and is simpler than forcing same-provider consistency across a request's calls.

**Decision: provider provenance is returned data, not wrapper state — for the same concurrency reason.**
`briefDraftSchema` and `cacheDraftSchema` (`src/lib/providers/draft.ts`) gain an optional `providerUsed: { name: string; model?: string }` field. It is **not** something the model is asked to produce — each concrete provider's `structure()`/`structureFromCache()` implementation sets it on the object it returns, after parsing the model's actual output. `assembleBrief()` copies `draft.providerUsed` onto `CompanyBrief.providerUsed`, and the cache-hit path in `pipeline.ts` (which already manually reconstructs a `BriefDraft` from a `CacheDraft`) copies `cacheDraft.providerUsed` the same way. The label reflects whichever provider did the *structuring* call specifically — that's the stage that authors the prose the user reads; which provider did `research()`/`researchNews()` is not separately surfaced.
*Alternative considered*: a mutable `lastProviderUsed` property on the `FallbackProvider` wrapper, read by the route after `generateBrief()` resolves. Rejected outright — unsafe under `compareCompanies()`'s concurrent calls against one shared wrapper instance; two in-flight requests would stomp each other's value.

**Decision: OpenRouter's retrieval step fetches and extracts full pages, not just Tavily snippets.**
Per the user's explicit choice (overriding the doc's "optionally fetch pages" as a cheaper default). `research()` calls Tavily, then fetches the top N result URLs (a small fixed N — see tasks.md) and extracts main-content text from each (strip nav/boilerplate), concatenating into the same kind of findings text Gemini's prose output would have produced, before handing it to the OpenRouter model for synthesis. A page that fails to fetch (timeout, 403, non-HTML) is skipped, not fatal to the whole request — same "don't let one thing block the rest" posture `compareCompanies()` already uses at the company level.

**Decision: OpenRouter structuring uses JSON-mode + an inlined schema description, not provider-native structured output.**
Gemini's `structure()` passes `responseJsonSchema` (a Gemini-specific parameter) built from `z.toJSONSchema(briefDraftSchema)`. OpenRouter's JSON-schema support varies by model and `OPENROUTER_MODEL` is left configurable rather than fixed, so the OpenRouter provider instead: (a) requests `response_format: { type: "json_object" }` (broadly supported on OpenRouter's instruct models), and (b) inlines the same `z.toJSONSchema(briefDraftSchema)` output as instruction text in the prompt, asking the model to conform to it. The response is parsed and validated with the existing `briefDraftSchema`/`cacheDraftSchema` exactly as Gemini's path already does — a validation failure becomes the existing `malformed_response` `BriefError`, which is already in the infrastructure-class retry set, so a malformed OpenRouter response surfacing *as the fallback* simply fails the request rather than retrying again (no third provider).

**Decision: infrastructure-class vs content-class is a fixed set keyed on existing `BriefErrorKind`s, not a new field.**
Retryable: `rate_limited`, `provider_error`, `not_configured`, `malformed_response`. Not retryable: `invalid_input`, `no_results`, `ambiguous`. This uses the error taxonomy that already exists (`src/lib/brief/errors.ts`) — no new classification mechanism.
*Note on `malformed_response`*: the proposal's user-provided retry list didn't explicitly name it, but it clearly belongs with the infrastructure class by the same logic as the other three — the research findings are fine, the provider just failed to deliver usable structured output. It's listed as retryable here as a deliberate call, not an oversight.

**Decision: the fallback provider is constructed from env, independent of how the primary was constructed.**
`src/lib/providers/index.ts` gets a `withFallback(primary: BriefProvider): BriefProvider` function. Both `getProvider()` (admin/env-key path) and `getProviderForApiKey()` (non-admin/session-key path) call `withFallback(...)` on their result before returning it. `withFallback` builds the OpenRouter provider from `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/`TAVILY_API_KEY` env vars; if any are absent, it returns `primary` unchanged (no wrapping at all) rather than a wrapper that always fails fallback — simplest possible "fallback is optional" implementation, and it means a non-admin session never needs its own OpenRouter/Tavily credentials.

## Risks / Trade-offs

- **[Risk]** Page-fetching adds latency and a new failure surface (arbitrary third-party sites: slow responses, bot-blocking, malformed HTML). → **Mitigation**: fixed small fetch count, per-page timeout, failures are skipped not fatal (see Decisions above). This only runs when Gemini has already failed, so it's added latency on an already-degraded path, not the common case.
- **[Risk]** `OPENROUTER_MODEL`'s free-tier availability may change without notice — the exact failure mode this whole feature exists to survive, now one level deeper. → **Mitigation**: none automated; documented in `.env.example` as "verify current availability," matching the existing (already-burned) lesson with `DEFAULT_GEMINI_MODEL`.
- **[Risk]** URL-level citation fidelity is a real quality regression versus Gemini's grounding, inherited directly from the original doc. → **Mitigation**: accepted, and visible to the user via the new provenance label — they can tell a brief came from the fallback and judge accordingly, rather than the regression being silent.
- **[Trade-off]** Two free tiers (OpenRouter, Tavily) to provision and monitor instead of one. → **Mitigation**: both are optional; the app owner can defer setting them up, and the feature degrades to today's behavior until they do.

## Migration Plan

1. Ship `openrouter.ts`, `fallback.ts`, the `providerUsed` schema/type additions, and the UI label together — they're only meaningfully testable as a unit (the label needs something to display, the schema field needs a producer).
2. No database schema change (nothing here touches storage) and no breaking change to any existing route's request/response shape beyond an added, optional `providerUsed` field on the brief — additive, not breaking.
3. Deploy with `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/`TAVILY_API_KEY` unset is a valid, safe state (fallback simply inactive) — the owner can add them whenever convenient after deploying the code.

## Open Questions

- Exact `OPENROUTER_MODEL` value and exact page-fetch count (N): left to tasks.md / implementation time, per the Non-Goals above — resolving them now would just be guessing at numbers that don't change the spec or the approach.
