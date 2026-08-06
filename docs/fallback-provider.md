# Fallback provider: OpenRouter + standalone search

The app runs on the Gemini API with Google Search grounding. This document
records the fallback path so it can be adopted without redesign if that stops
being viable — throttled quota, changed terms, deprecated model, or quality
regression.

**Nothing here is implemented.** It is a design note, deliberately written down
while the constraints are fresh.

## Why a fallback is planned at all

The provider is a free tier. Free tiers get throttled, re-priced, or retired
with little notice, and this tool is needed on the specific weeks placements
run. The `BriefProvider` seam exists for that reason rather than for
architectural tidiness.

## What has to change, and what does not

The seam is `src/lib/providers/types.ts`. A replacement implements two methods:

```ts
research(request: ResearchRequest): Promise<ResearchResult>
structure(request: StructureRequest): Promise<BriefDraft>
```

Unchanged by a provider swap:

- the brief schema and types (`src/lib/brief/types.ts`)
- section policy and 4P applicability (`src/lib/brief/sectors.ts`, `plan.ts`)
- assembly and enforcement (`src/lib/brief/assemble.ts`)
- the pipeline (`src/lib/brief/pipeline.ts`)
- every component under `src/components/`
- the whole test suite, which runs against the fake provider

Changed: one new file under `src/lib/providers/`, plus a branch in
`getProvider()` in `src/lib/providers/index.ts`.

## The shape of the fallback

Gemini collapses retrieval and generation into one grounded call. OpenRouter
models generally have no built-in web search, so retrieval becomes a separate
step:

```
  research():
    1. query a search API (Tavily or Brave) with buildResearchQueries()
    2. optionally fetch and extract the top N result pages
    3. send snippets to an OpenRouter model for synthesis + classification
    4. map search results -> SourceRef[]   (instead of grounding metadata)

  structure():
    5. send findings + SectionPlan to an OpenRouter model with a JSON schema
       (or a JSON-mode prompt, if the model lacks schema support)
```

Candidate search APIs, both with usable free tiers: **Tavily** (LLM-oriented,
returns clean snippets) and **Brave Search API** (broader index). Either is a
better fit than a news-specific API, which under-indexes the Indian business
press this audience needs.

Candidate models on OpenRouter: whichever free or low-cost instruct model
currently supports structured output well. This is the part most likely to have
changed by the time the fallback is needed — check availability then rather than
trusting a name recorded here.

## What gets better and what gets worse

Better:

- Model choice becomes independent of search, so either can be swapped alone.
- Retrieval becomes inspectable: snippets exist as data before generation, so
  news filtering can finally be unit-tested against fixed snippet fixtures —
  the testability that the grounded design gives up.

Worse:

- Citation fidelity drops from span-level grounding to URL-level attribution.
  The `basis` / `sourceIds` contract still holds, but the link between a
  sentence and its source is weaker, and `assembleBrief`'s downgrade rule does
  more work.
- Two free tiers to manage instead of one, with two sets of limits and terms.
- More code: query construction, result fetching, extraction, and dedup all
  become ours.
- Latency rises — search round-trip, then two model calls.

## Adopting it

1. Add `src/lib/providers/openrouter.ts` implementing `BriefProvider`.
2. Reuse `buildResearchQueries()` and the prompts in `prompts.ts`; both are
   provider-neutral.
3. Map search results to `SourceRef[]` with the same positional `s1..sN` ids
   `mapGroundingToSources()` produces — the ids are what the structuring stage
   cites and what `assembleBrief` validates against.
4. Reuse `translateGeminiError`'s classification approach: rate limits must
   surface as `rate_limited`, not as generic `provider_error`, or the UI will
   tell the user the wrong thing to do.
5. Add the branch in `getProvider()` keyed on `BRIEF_PROVIDER=openrouter`.
6. Run the existing suite — it should pass untouched. If it does not, the seam
   has been broken rather than extended.
