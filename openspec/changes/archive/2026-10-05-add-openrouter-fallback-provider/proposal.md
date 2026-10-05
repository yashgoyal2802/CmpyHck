## Why

The Gemini API is this app's only research provider, and today a Gemini-side failure (quota exhaustion, a deprecated model, rate limiting, an outage) means every user — admin and non-admin alike — simply can't generate a brief until it clears up. This has now happened in practice. `docs/fallback-provider.md` already designed an OpenRouter-backed alternative for exactly this scenario, specifically so it could be adopted without redesign; it was never implemented. Building it now turns a single point of failure into a provider that degrades instead of stopping.

## What Changes

- Add an OpenRouter-backed `BriefProvider` implementation, following `docs/fallback-provider.md`'s plan: Tavily for web search (replacing Gemini's built-in grounding), full page fetch-and-extract on top of search results for research depth, and an OpenRouter chat model for synthesis and structuring (JSON-mode output, validated against the existing `briefDraftSchema`/`cacheDraftSchema`).
- Every brief-generation request automatically tries the primary provider (Gemini — the server's key for admin, the session's own key for non-admin) first; a call that fails with an infrastructure-class error (`rate_limited`, `provider_error`, `not_configured`, `malformed_response`) automatically retries via the OpenRouter fallback instead of surfacing the error to the user. A content-class outcome (`invalid_input`, `no_results`, `ambiguous`) is never retried — it's a legitimate result, not an infrastructure failure.
- The fallback is a shared, app-owned resource (one `OPENROUTER_API_KEY` / `TAVILY_API_KEY` pair configured by the owner), used for every user's fallback regardless of role — non-admin users are not asked for a second set of keys on top of their own Gemini key.
- The fallback is optional infrastructure: when its env vars aren't configured, the app behaves exactly as it does today (a Gemini failure surfaces as it always has) rather than requiring the new keys to function at all.
- A completed brief now records which provider actually produced it, and the brief view renders a small, visible label ("Generated with Gemini" / "Generated with OpenRouter") so a user can tell when the fallback was used.

## Capabilities

### New Capabilities
- `research-provider-fallback`: automatic, per-request fallback from the primary research provider to an OpenRouter-backed alternative on infrastructure-class failures, plus the provider-provenance label shown on a generated brief.

### Modified Capabilities
- `company-preparation-brief`: provider failure handling changes from "report that research could not be completed" as the only outcome to "retry via the fallback provider first, and only report failure if that also fails."

## Impact

- New file `src/lib/providers/openrouter.ts` implementing `BriefProvider` per the existing seam (`src/lib/providers/types.ts`) — no change to that interface.
- New file `src/lib/providers/fallback.ts` (or similar): a `BriefProvider` wrapper that tries a primary provider, retries via a fallback provider on infrastructure-class errors, and is a no-op passthrough when the fallback isn't configured.
- `src/lib/providers/index.ts`: `getProvider()` and `getProviderForApiKey()` both wrap their result through the fallback wrapper.
- `src/lib/providers/draft.ts`: `briefDraftSchema` / `cacheDraftSchema` gain an optional `providerUsed` field, set by provider code after parsing — not requested from the model.
- `src/lib/brief/types.ts` (`companyBriefSchema`) and `src/lib/brief/assemble.ts`: `CompanyBrief` carries `providerUsed` through from the draft.
- `src/lib/brief/pipeline.ts`: the cache-hit path's manual `BriefDraft` reconstruction threads `providerUsed` through from the cache-hit draft.
- `src/components/BriefView.tsx` (or wherever the brief header renders): new small provider label.
- New env vars: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (model availability must be checked at adoption time, per the existing doc's own caution — not hardcoded with confidence), `TAVILY_API_KEY`.
- `.env.example` documents the new, optional vars.
- No change to `src/lib/brief/pipeline.ts`'s control flow, `assemble.ts`'s enforcement rules, section planning, or any component beyond the new label — the fallback is entirely contained behind the existing `BriefProvider` seam, as `docs/fallback-provider.md` intended.
