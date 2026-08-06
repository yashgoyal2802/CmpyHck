## Context

See `proposal.md` for motivation. The repository currently contains OpenSpec planning artifacts but no application implementation, so this change can establish the first product workflow and technical structure.

The user is an SPJIMR MBA candidate preparing for final placements, sharing the tool with 3-4 classmates. That scale is small enough that infrastructure concerns (caching, throughput, multi-tenancy) are not design drivers, and quality of the generated brief is the only thing that matters.

The first version needs current external information, but it must avoid presenting unsourced generated content as fact. The brief should be useful for a placement candidate even when public information is sparse.

## Goals / Non-Goals

**Goals:**

- Create a simple end-to-end workflow: company name input, research retrieval, structured brief output.
- Keep factual research, inferred analysis, and unavailable information visually and structurally distinct.
- Tailor the brief's sections to the company's sector, so each brief matches how that sector's interviews are actually conducted.
- Design the brief format so future placement features can be added without rewriting the core flow.
- Support current news and business signals through source-backed retrieval.
- Restrict access to people who hold a shared passphrase.
- Stay within freely available or free-tier provider quotas.

**Non-Goals:**

- Build a full CRM or job tracking system in the first slice.
- Guarantee exhaustive company intelligence across every source on the internet.
- Automatically apply to jobs or interact with placement portals.
- Build a saved-brief UX with personal notes in the first slice (deferred to a follow-up; see the persistence decision below).
- Support open public sign-up or scale beyond a handful of users.

## Decisions

### Use a brief pipeline with explicit stages

The application will organize work into three stages:

1. Normalize the submitted company name and build research queries.
2. Retrieve source-backed evidence and a sector classification from the provider.
3. Turn the classification into a section plan, in our own code.
4. Generate the structured preparation brief for exactly those sections.
5. Assemble the brief, enforcing the rules the spec makes non-negotiable.

Step 5 is enforcement rather than trust. Prompts request the fixed section counts, the conditional 4P, and the fact-versus-analysis distinction; assembly guarantees them. Where the two disagree the code wins: a 4P section returned for a sector that excludes it is dropped, counts are trimmed to their limits, and any claim marked as sourced whose citations do not resolve is downgraded to analysis. Shortfalls are recorded in the brief rather than padded, because padding means fabricating.

Alternatives considered:

- Model-knowledge-only generation: faster to build, but too likely to invent recent news.
- Manual-only note entry: reliable, but does not solve the user's need for quick preparation.

### Classify by MBA sector, not by service-vs-product

The brief's deep-dive sections are selected by the company's sector or role family, not by whether it is service-based. Service-vs-product is an engineering-campus distinction and does not predict what an MBA interview will probe.

Classification buckets:

- `consulting` — recent engagements, deal and client signals, practice areas, positioning against peer firms
- `fmcg` — 4P analysis at full weight, brand portfolio, go-to-market and distribution
- `bfsi` — regulatory developments, financial performance arc, digital and product strategy
- `tech` — product roadmap, competitive moat, platform and monetization strategy
- `conglomerate` — group structure, capital allocation, business unit priorities
- `other` — a general business-context deep dive

Classification is presented as a likely classification, not an assertion, and the brief states which bucket was used so the student can judge whether it fits.

Alternatives considered:

- Service-vs-product classification: mis-tuned for the audience; produces a client-signals section that is irrelevant for most MBA targets and misses the distinctions that matter.
- No classification, one fixed section set: simpler, but pads every brief with sections that do not apply and dilutes the ones that do.

### Make 4P analysis conditional on sector

4P is generated at full weight for sectors where marketing framing drives the interview (notably `fmcg`, and marketing-oriented roles generally). For sectors where it adds little — `bfsi` in particular — it is omitted rather than filled with generic industry-level inference.

Where 4P is generated but company-specific evidence is thin, it may use industry-level reasoning, and the output must label that as inferred context.

Alternatives considered:

- 4P for every company: produces filler for finance and tech targets, consuming a section that a sector-appropriate deep dive would use better.
- Never generate 4P: loses the single most-probed framework for FMCG and marketing interviews.

### Treat current information as externally sourced

Recent news and business signals come from live web search performed as part of brief generation, with each factual claim retaining a source reference and date when available.

If a source is unavailable, stale, or ambiguous, the brief says so instead of filling the gap with guesses.

News selection ranks results by placement usefulness, not just recency. Higher-value signals include strategic moves, deal and client wins, partnerships, expansion, product and brand launches, campus or hiring moves, and financial results that reveal direction. Lower-value signals include generic stock-price movement, vague CSR announcements, stale press releases, and similarly named but unrelated companies.

Indian business press coverage matters disproportionately for this audience, which favours general web search over news-specific APIs that under-index those sources.

Alternatives considered:

- Use only model knowledge: insufficient for recent news and placement preparation.
- Require the user to paste links: reliable, but slows the core workflow.

### Use a free-tier LLM provider with built-in search grounding, in two stages

Retrieval and generation both run against a provider that searches the web itself and returns grounding metadata with source references, rather than a separate retrieval stage feeding snippets into a model.

This is implemented as **two calls, not one**. Gemini cannot combine Google Search grounding with a JSON response schema in a single request, so grounded research and schema-constrained structuring must be separate. That constraint turned out to be useful rather than merely tolerable: the gap between the two calls is where section policy runs. Stage one classifies, our own code turns that classification into a section plan, and stage two is told which sections to produce. Section selection is therefore decided by the code, not delegated to a prompt.

The initial provider is the Gemini API with Google Search grounding, chosen because it offers a free tier, performs search inside generation, returns citation and source metadata natively, and supports schema-constrained structured output. The specific model is selected at implementation time against current provider documentation.

Consequences accepted:

- Free-tier rate limits apply per minute and per day. The single-company-at-a-time UI keeps normal use well within them; bulk generation is not supported.
- Free-tier data-use terms differ from paid tiers. The brief contains no private user data, so this is acceptable for this application.
- Because search happens inside generation, filtering behaviour cannot be unit-tested against fixed snippet fixtures. Tests instead exercise the brief assembler and renderer against fixture briefs from a fake provider.

Alternatives considered:

- Paid frontier model with server-side search: better quality ceiling, but outside the intended cost envelope.
- Separate free search API (Tavily, Brave) feeding a free OpenRouter model: model-agnostic and snippet-level testable, but manages two free tiers and yields weaker citation fidelity. Retained as the fallback path.

### Keep a provider seam around brief generation

Brief generation sits behind a provider interface, with a fixture-backed fake implementation used in tests. This is operational insurance rather than architectural preference: free tiers get throttled, deprecated, or re-priced with little warning, and the fallback path above must be adoptable without touching the brief pipeline, the schema, or the UI.

### Turn research into interview preparation

The brief does not stop at collected information. It translates the source-backed company context into two practical sections:

- talking points the student can use in answers such as "Why do you want to join this company?"
- thoughtful questions the student can ask the interviewer

These sections use analysis and inference but remain connected to the available research and avoid pretending uncertain facts are known. The MVP produces 5 talking points and 3 interviewer questions so output is predictable and easy to scan.

Alternatives considered:

- Only show research sections: accurate, but leaves the student to do the hardest preparation step alone.
- Generate a full mock interview in the first slice: valuable later, too broad for the first usable workflow.

### Build on Next.js

The application is a Next.js (App Router) TypeScript app deployed to Vercel. Provider API keys stay server-side in route handlers, the structured brief maps directly onto React sections, and sharing with classmates is a URL.

Alternatives considered:

- Python backend with a thin frontend: reasonable if the analysis layer were Python-heavy, but it is a single provider call.
- Streamlit: fastest to a demo, but fights copy-friendly formatting and repeated in-place searches.

### Gate access with a shared passphrase

Access is a single shared passphrase held in environment configuration, exchanged for a signed, expiring session cookie. Protected routes are gated in middleware so a new route is protected by default, with a second check in the brief route because that handler consumes research quota.

What is actually being protected is the free-tier research quota, not user data: briefs are not persisted and no personal information is stored. A shared secret is correctly sized for a group of classmates who all know each other, and revocation is rotating the passphrase.

Access control fails closed. An unset passphrase or signing secret denies everyone, including the owner, because a misconfigured deployment should lock the door rather than remove it.

Alternatives considered:

- Google sign-in with an email allowlist: gives per-user identity and single-user revocation, but requires an OAuth client, consent screen, and redirect configuration. Its only benefit over a passphrase is identity, which nothing in this change uses — that benefit belongs to the deferred saved-briefs feature, so the setup cost would be paid now for a benefit that may never land. Revisit when saved briefs are built; the session module is the only thing that has to change.
- No access control, relying on an unlisted URL: anyone who finds the URL burns the free-tier quota.

Trade-off accepted: the app cannot tell its users apart, and revoking one person means rotating the passphrase for everyone.

### Defer saved briefs, but design for them

Persisting briefs with the student's own notes is genuinely valuable for this user — a company is prepared over days, across shortlist, pre-placement talk, and interview. It is deferred to a follow-up change only to keep the first slice small.

The structured brief shape is chosen so that adding storage later is additive. Per-user identity is not: with a shared passphrase the app cannot tell its users apart, so saved briefs would either be shared by everyone or require introducing sign-in at that point. That is the right order — identity earns its setup cost when there is per-user data to attach it to, not before. Caching briefs for cost or latency reasons is explicitly not a goal at this scale.

### Keep the first UI focused on repeated preparation

The first screen is the working app: a company input, loading and research state, and the generated brief. It does not start with a marketing landing page. The interface supports scanning, source checking, and copying notes.

## Risks / Trade-offs

- Free-tier rate limits may throttle bursts -> keep the UI to one company at a time; the provider seam allows swapping if limits become binding.
- Free-tier availability or terms may change -> provider interface plus a documented OpenRouter-and-search-API fallback.
- Search results may contain irrelevant companies with similar names -> company-name normalization, visible source titles and domains, and placement-usefulness filtering.
- Sector classification can be fuzzy, especially for diversified firms -> present it as a likely classification, show it to the user, and keep the general deep dive as a fallback.
- Generated analysis may blur facts and inference -> keep sourced facts, talking points, interviewer questions, and generated analysis in separate fields with distinct labels.
- Some companies may have little public information -> provide a useful fallback brief with explicit unavailable sections.
- Search-inside-generation reduces unit-test surface for filtering -> compensate with fixture-based tests of the assembler, renderer, and section selection, plus manual verification against real companies.

## Migration Plan

1. Add the initial Next.js application structure and the company brief workflow.
2. Add shared-passphrase access control with a signed session cookie, gated in middleware.
3. Add source-backed brief generation behind a provider interface.
4. Add sector classification and conditional section rendering.
5. Add validation and tests for empty input, no-news results, sector classification, conditional 4P, talking points, and interviewer questions.
6. Roll back by disabling the route or reverting the deployment if the implementation is not yet stable.
