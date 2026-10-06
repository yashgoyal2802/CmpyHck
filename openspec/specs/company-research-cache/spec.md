# company-research-cache Specification

## Purpose

Avoid re-researching a company's stable facts from scratch on every search, while guaranteeing that recent news is always fetched fresh and that a cached fact never loses its source citation.

## Requirements

### Requirement: Stable facts are cached and reused
The system SHALL cache the overview, sector classification, deep-dive content, and 4P analysis (when present) produced for a company, and SHALL reuse that cached content on a subsequent search for the same company instead of re-researching it, as long as the cached entry has not expired.

#### Scenario: Repeat search within the cache window
- **WHEN** a company is searched again before its cached entry expires
- **THEN** the system reuses the cached overview, classification, deep-dive content, and 4P analysis instead of researching them again

#### Scenario: First-ever search
- **WHEN** a company has no cached entry
- **THEN** the system researches it in full and stores the resulting stable facts in the cache

### Requirement: Recent news is always fetched fresh
The system SHALL NOT serve a cached recent-news item as current; every search SHALL fetch news fresh regardless of whether stable facts were served from cache.

#### Scenario: Cache hit still fetches fresh news
- **WHEN** a company's stable facts are served from cache
- **THEN** the brief's recent news section is still generated from a fresh search, not from any prior cached news

### Requirement: Cached facts expire and are refreshed
The system SHALL treat a cached entry as expired after a configured period and SHALL re-research the company in full when an expired or missing entry is requested.

#### Scenario: Cache entry has expired
- **WHEN** a company's cached entry is older than the configured expiry period
- **THEN** the system re-researches the company in full, as if no cached entry existed, and replaces the cached entry with the new result

#### Scenario: User forces a refresh
- **WHEN** a user explicitly requests a fresh check of a company rather than relying on the cache
- **THEN** the system re-researches the company in full regardless of whether the cached entry has expired

### Requirement: Cached facts keep working source citations
The system SHALL preserve the source citations backing every cached claim, such that a claim served from cache continues to resolve to a real, checkable source after being combined with a fresh search's sources.

#### Scenario: Cached claim cited alongside fresh sources
- **WHEN** a brief combines cached stable facts with freshly researched news in the same response
- **THEN** every citation on a cached claim still resolves to a real source, and every citation on fresh news resolves to a real source, with no collision between the two

### Requirement: Repeat search shows what changed
When a company's stable facts are served from cache, the system SHALL show the user what is new in the fresh news since the company was last searched.

#### Scenario: New developments since last search
- **WHEN** a company is re-searched and new relevant news has appeared since the last search
- **THEN** the system highlights what is new, in addition to presenting the full current brief

#### Scenario: Nothing new since last search
- **WHEN** a company is re-searched and no new relevant news is found beyond what was already shown last time
- **THEN** the system states that nothing new was found rather than fabricating an update

### Requirement: Caching is not user-scoped
The system SHALL share cached company facts across all users; the cache SHALL NOT be private to the user who triggered the original research.

#### Scenario: Different users search the same company
- **WHEN** two different users search the same company within the cache window
- **THEN** the second user's search reuses the same cached facts the first user's search produced
