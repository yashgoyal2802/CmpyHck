## 1. Provider provenance (schema/type plumbing)

- [x] 1.1 In `src/lib/providers/draft.ts`, add `providerUsed: z.object({ name: z.string(), model: z.string().optional() }).optional()` to both `briefDraftSchema` and `cacheDraftSchema`. (Schema defined once as `providerUsedSchema` in `src/lib/brief/types.ts` and reused, rather than duplicated.)
- [x] 1.2 In `src/lib/brief/types.ts`, add the same optional `providerUsed` field to `companyBriefSchema`.
- [x] 1.3 In `src/lib/brief/assemble.ts`, copy `draft.providerUsed` onto the assembled `CompanyBrief`.
- [x] 1.4 In `src/lib/brief/pipeline.ts`'s `tryCacheHit`, copy `cacheDraft.providerUsed` onto the manually-reconstructed `BriefDraft` so the cache-hit path carries provenance through the same way the full-research path does.
- [x] 1.5 In `src/lib/providers/gemini.ts`, set `providerUsed: { name: "gemini", model }` on the objects returned by `structure()` and `structureFromCache()`.

## 2. OpenRouter provider

- [x] 2.1 Add `cheerio` as a dependency for main-content extraction from fetched pages.
- [x] 2.2 Create `src/lib/providers/openrouter.ts` exporting `createOpenRouterProvider(options: { apiKey: string; model: string; tavilyApiKey: string })` returning a `BriefProvider`.
- [x] 2.3 Implement Tavily search: POST to Tavily's search endpoint with `buildResearchQueries(company)`. (Live-verified against the real API with the user's key before implementing: `POST https://api.tavily.com/search`, `Authorization: Bearer <key>`, JSON body `{query, max_results}`, response `{results: [{url,title,content,...}]}`.)
- [x] 2.4 Implement page fetch-and-extract: top 4 Tavily results (`MAX_PAGES_TO_FETCH`), each fetched with a 6s timeout (`AbortController`), extracted with `cheerio` (strip script/style/nav/header/footer/svg), capped at 3000 chars. Any fetch/parse failure or non-HTML content type returns `null` rather than throwing - one bad page never fails the request.
- [x] 2.5 Map Tavily results to `SourceRef[]` with positional `s1..sN` ids (`mapTavilyToSources`), reusing `domainFromUrl` from `grounding.ts` for the label. (Tavily didn't return a usable per-result date in testing, so `date` is left unset - same as Gemini's mapping does when grounding doesn't supply one.)
- [x] 2.6 Implement `research()`: `buildResearchPrompt()` reused unchanged, with an appended block (`withRetrievalOverride`) supplying the retrieved content and telling the model it has no search tool of its own - necessary because the prompt's own text assumes tool-based search, which only Gemini has. Parsed via the existing, fully provider-agnostic `parseResearchText()` - no fork needed.
- [x] 2.7 Implement `structure()`: `buildStructurePrompt()` reused unchanged, with an appended inlined `z.toJSONSchema(briefDraftSchema)` instruction block (`withJsonSchemaInstruction`). `response_format: json_object` requested from OpenRouter; parse/validate/error-handling mirrors `gemini.ts`'s `structure()` exactly, down to the same `malformed_response` message shape. Sets `providerUsed: { name: "openrouter", model }`.
- [x] 2.8 Implement `researchNews()`: same search+fetch+extract approach, scoped via `buildNewsResearchPrompt()` + the same retrieval-override append.
- [x] 2.9 Implement `structureFromCache()`: same JSON-mode approach via `buildCacheStructurePrompt()`, with `z.toJSONSchema(cacheDraftSchema)` inlined. Sets `providerUsed: { name: "openrouter", model }`.
- [x] 2.10 Implemented as `translateHttpError()`: 429 → `rate_limited` (reading `retry-after` when present), 401/403 → `not_configured`, anything else → `provider_error`. Shared by both the Tavily and OpenRouter call sites.

## 3. Fallback wrapper and wiring

- [x] 3.1 Create `src/lib/providers/fallback.ts` exporting `withFallback(primary: BriefProvider, fallback: BriefProvider | null): BriefProvider`. When `fallback` is `null`, return `primary` unchanged (no wrapping).
- [x] 3.2 Implement the wrapper's four methods: call `primary`'s method; on a thrown `BriefError` whose `kind` is in the infrastructure-class set (`rate_limited`, `provider_error`, `not_configured`, `malformed_response`), call the same method on `fallback` and return/throw its result instead. Any other error (or the content-class kinds) propagates from `primary` without a fallback attempt.
- [x] 3.3 In `src/lib/providers/index.ts`, add a function that builds the OpenRouter provider from `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/`TAVILY_API_KEY` env vars, returning `null` if any are unset.
- [x] 3.4 Wrap `getProvider()`'s return value and `getProviderForApiKey()`'s return value through `withFallback(..., thatOpenRouterProviderOrNull)` before returning. (Also changed `getProvider()`'s missing-`GEMINI_API_KEY` case from a synchronous throw to a lazily-failing `createUnconfiguredProvider` - `not_configured` is in the retryable set, so a missing admin key now also gets a chance to fall back, rather than being a special unrecoverable case. Updated `tests/provider-selection.test.ts` for the new deferred-throw contract.)

## 4. UI label

- [x] 4.1 Add a small, visible label to the rendered brief (near the header, alongside existing metadata) showing `providerUsed`: e.g. "Generated with Gemini" when `providerUsed.name === "gemini"`, "Generated with OpenRouter (fallback)" otherwise. Omitted gracefully (conditional render) when `providerUsed` is absent (e.g. older cached briefs generated before this change).
- [x] 4.2 Confirmed: `ComparisonWorkspace.tsx` renders each result via `<BriefView brief={result.brief} />` - the same component - so the label already shows per-company with no separate change needed.

## 5. Configuration

- [x] 5.1 Added `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `TAVILY_API_KEY` to `.env.example`, documented as optional and noting that `OPENROUTER_MODEL`'s free-tier availability must be verified at setup time rather than trusted from any example value.

## 6. Verification

- [x] 6.1 Add tests for `withFallback`: primary success never calls fallback; each infrastructure-class error triggers a fallback call; each content-class error does not; fallback's own failure propagates when both fail; `fallback: null` always uses primary only. (`tests/fallback.test.ts`)
- [x] 6.2 Add a concurrency test mirroring `compareCompanies()`'s usage: two simultaneous calls through the same wrapper instance, one primary-success and one primary-failure-then-fallback-success, confirm neither call's result is affected by the other (guards the stateless-wrapper decision in design.md). (`tests/fallback.test.ts`)
- [x] 6.3 Add tests confirming `providerUsed` flows correctly through `assembleBrief()` for the full-research path (`tests/assemble.test.ts`) and through `pipeline.ts`'s cache-hit reconstruction for the cache-hit path (`tests/cache.test.ts`). The fake provider (`fake.ts`) now also sets `providerUsed: { name: "fake" }` on both structuring calls, matching the real providers' own self-reporting behavior.
- [x] 6.4 Add tests for the OpenRouter provider's response parsing/validation (malformed JSON, schema-invalid JSON, empty response) producing the same `malformed_response` `BriefError` shape as Gemini's path, plus `no_results` and the Tavily/OpenRouter HTTP error translation (429→rate_limited incl. retry-after, 401→not_configured) - all via a mocked `fetch`, no live API calls. (`tests/openrouter.test.ts`)
- [x] 6.5 Ran the existing full test suite: 167/167 pass. Only pre-existing files touched outside this change's new files were `tests/provider-selection.test.ts` (updated for `getProvider()`'s now-deferred not_configured throw - a deliberate, called-out design decision, not an accidental break) and `src/lib/providers/fake.ts` (now sets `providerUsed`, same self-reporting behavior as the real providers).
- [x] 6.6 Manually verified end-to-end with real `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/`TAVILY_API_KEY` values (no browser tool available in this session, so verified via a one-off script calling `getProvider()` + `generateBrief()` directly - the same code path the API route uses - rather than through the UI): with `GEMINI_API_KEY` deliberately broken, requested a brief for "Zomato". Result: Gemini failed immediately, the fallback transparently took over, and a real, well-sourced brief came back (`providerUsed: {"name":"openrouter","model":"nvidia/nemotron-3-super-120b-a12b:free"}`, 6 real sources, coherent overview). Script deleted after verification. UI label itself (task 4.1) still needs a live browser check against the running app, which the user can do.
