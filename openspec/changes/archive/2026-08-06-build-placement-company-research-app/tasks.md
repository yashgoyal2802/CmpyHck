## 1. Application Foundation

- [x] 1.1 Scaffold a Next.js (App Router) TypeScript app with a server-side route handler for brief generation
- [x] 1.2 Add a first-screen company research interface with company-name input, submit action, loading state, and validation message
- [x] 1.3 Define the structured company brief data model for overview, sector classification, news, sector deep dive, optional 4P, talking points, interviewer questions, sources, and unavailable sections
- [x] 1.4 Add shared-passphrase access control with a signed, expiring session cookie, gated in middleware and re-checked in the brief route

## 2. Research Provider

- [x] 2.1 Create a brief-generation provider interface covering company research and structured brief output, with a fixture-backed fake implementation for tests
- [x] 2.2 Implement the Gemini provider using Google Search grounding for retrieval and a response schema for structured output; select and pin the model against current provider docs
- [x] 2.3 Implement company-name normalization and query construction for company research
- [x] 2.4 Map provider grounding metadata onto the brief's source references, preserving title, URL or source label, and date when available
- [x] 2.5 Instruct and constrain the provider to rank news by placement usefulness, de-emphasizing generic stock movement, vague CSR items, stale press releases, and wrong-company matches
- [x] 2.6 Handle no-result, ambiguous-result, rate-limit, and provider-error cases without fabricating facts
- [x] 2.7 Document the OpenRouter plus standalone-search fallback path against the same provider interface (no implementation required in this change)

## 3. Brief Generation

- [x] 3.1 Implement the brief assembly pipeline from submitted company name to classification to structured brief
- [x] 3.2 Classify the company into consulting, FMCG, BFSI, tech, conglomerate, or other, and surface the classification in the brief
- [x] 3.3 Generate 3 to 5 concise recent-news summaries from sourced research, including why each item matters for interview preparation
- [x] 3.4 Generate the sector-specific deep dive for the classified sector, with a general deep dive as the fallback
- [x] 3.5 Generate 4P analysis only for sectors where it applies, using company-specific evidence when available and labeled industry inference otherwise
- [x] 3.6 Generate 5 interview talking points that connect research findings to placement interview answers
- [x] 3.7 Generate 3 thoughtful questions the student can ask the interviewer without assuming unsupported facts
- [x] 3.8 Separate sourced facts from generated analysis in the structured brief output

## 4. Brief Presentation

- [x] 4.1 Render overview, sector classification, recent news, sector deep dive, 4P when present, talking points, interviewer questions, and source references in clearly separated sections
- [x] 4.2 Render section sets conditionally based on the classified sector, omitting sections that do not apply
- [x] 4.3 Display explicit unavailable states for missing news and missing deep-dive evidence, and a retry path for provider errors
- [x] 4.4 Add copy-friendly formatting for preparation notes without hiding source references
- [x] 4.5 Ensure the UI supports repeated company searches without requiring a page refresh

## 5. Verification

- [x] 5.1 Add tests for empty company-name submission
- [x] 5.2 Add tests for access control: correct passphrase admitted, wrong passphrase denied, unconfigured denies all, tampered and expired sessions rejected
- [x] 5.3 Add tests for successful brief generation from a fixture brief, including source references
- [x] 5.4 Add tests for news item counts and interview relevance explanations
- [x] 5.5 Add tests for no recent news found
- [x] 5.6 Add tests for sector classification driving section selection across at least consulting, FMCG, and BFSI fixtures
- [x] 5.7 Add tests for 4P present in a marketing-relevant sector and omitted in BFSI, including the industry-inference label
- [x] 5.8 Add tests for exactly 5 interview talking points and 3 interviewer questions
- [x] 5.9 Add tests for provider error and rate-limit handling
- [x] 5.10 Run the app locally and verify the workflow against at least four real companies spanning different sectors

## 6. Deployment

- [x] 6.1 Deploy to Vercel with provider API key, access passphrase and auth secret configured as environment variables
- [x] 6.2 Verify passphrase entry, brief generation, and free-tier rate-limit behavior on the deployed instance
