# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is an SPJIMR MBA candidate preparing for final campus placements, sharing the tool with a small group of 3-4 classmates. No self-registration — accounts are provisioned by the app owner. Usage is concentrated and repeated across a single placement season, not ongoing/casual.

## Product Purpose

Turns a company name into a structured, interview-ready preparation brief, so a student doesn't have to manually piece together context from news sites, company pages, and analyst commentary before an interview.

## Positioning

Briefs are sector-aware and tailored to MBA-relevant role families (consulting, FMCG/marketing, BFSI, tech/product, general management) rather than generic company summaries — sections like the 4P analysis, deep-dive facts, and interview talking points adapt to the company's classified sector/role family instead of being one-size-fits-all.

## Operating Context

Used in bursts during placement season: a student works through a shortlist of roughly 15-20 target companies, often re-checking the same company multiple times as interviews approach. Company research is cached server-side (stable facts) and reused across users to avoid re-researching from scratch and to conserve free-tier API quota; news is always fetched fresh. Personal prep tracking (status, interview date, confidence) is private per account. Company comparison (2-3 companies side by side) is a supported workflow alongside the single-company brief.

## Capabilities and Constraints

- Username/password accounts, provisioned by the app owner only — no self-registration, no shared passphrase.
- Server-side cache of the stable parts of a company brief (overview, sector classification, deep-dive facts), shared across all users; news is never cached.
- "What's changed" view showing what's new since a company was last cached.
- Personal organizer: private per-account tracking of prep status, interview date, and confidence rating per company.
- Company comparison view for 2-3 companies.
- Built on freely available or free-tier LLM and search providers rather than paid frontier APIs — this is a deliberate cost constraint, not an interim state.
- Small hosted deployment (Next.js + Neon Postgres), not built for public/high-traffic scale.

## Evidence on Hand

All brief content (news, business updates, sector classification, 4P analysis, talking points) is fetched live from real news/search sources and generated per request — nothing is pre-curated or fabricated. There are no testimonials, case studies, pricing, or benchmark claims in this product, and none should be invented.

## Product Principles

- Optimize for a repeat user working a shortlist under time pressure, not a first-time visitor — the tool should get out of the way of fast, repeated lookups.
- Tailor depth and structure to what the sector/role family actually makes interview-relevant; don't force every section (e.g. 4P analysis) onto every company.
- Respect the free-tier cost constraint: prefer caching and reuse over re-fetching, and don't design flows that assume unlimited API budget.
- Keep this a small-trust-group tool: access control and data isolation (per-user organizer data) matter more than broad onboarding or discovery.

## Accessibility & Inclusion

No product-specific requirement beyond normal good practice.
