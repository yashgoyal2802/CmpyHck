## Why

MBA students preparing for campus placements need quick, reliable company context without manually searching across news sites, company pages, and analyst commentary. A focused research app can turn a company name into interview-ready preparation notes.

The primary user is an SPJIMR MBA candidate preparing for final placements, sharing the tool with a small group of classmates (3-4 people total). Preparation targets MBA role families — consulting, FMCG/marketing, BFSI, tech/product, and general management — where interview questions center on recent strategic moves, competitive positioning, and business understanding rather than mass-hiring service-company context.

## What Changes

- Add an application workflow where a user enters a company name and receives a structured company preparation brief.
- Include recent company news and noteworthy business updates relevant to placement preparation.
- Classify the company into an MBA-relevant sector or role family, and tailor the brief's deep-dive sections to that classification.
- Generate a 4P analysis where the sector makes it interview-relevant (notably FMCG and marketing-heavy roles), rather than for every company.
- Generate interview talking points and thoughtful questions the student can ask the interviewer.
- Restrict access to a small allowlist of known users.
- Establish the foundation for future preparation features such as saved briefs with personal notes, role-specific questions, interview experiences, and competitor comparisons.

## Capabilities

### New Capabilities

- `company-preparation-brief`: Covers creating structured placement-preparation research briefs from a company name, including sector classification, news, sector-specific deep dives, conditional 4P analysis, interview talking points, and interviewer questions.

### Modified Capabilities

- None.

## Impact

- Adds a user-facing research workflow for MBA campus placement preparation.
- Requires a data retrieval strategy for current company news and business signals.
- Requires a structured analysis layer to summarize findings into preparation-friendly sections.
- Introduces a hosted deployment with sign-in restricted to an allowlist.
- Uses freely available or free-tier LLM and search providers rather than paid frontier APIs.
