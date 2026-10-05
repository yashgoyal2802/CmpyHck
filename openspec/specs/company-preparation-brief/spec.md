# company-preparation-brief Specification

## Purpose
Provide MBA students with a structured, placement-focused company research brief from a company name, tailored to the company's sector, so they can prepare for interviews using recent business context and sector-appropriate analysis.
## Requirements
### Requirement: Restricted access
The system SHALL restrict use to holders of a configured shared passphrase, SHALL NOT offer public sign-up, and SHALL deny all access when access control is not configured.

#### Scenario: Correct passphrase is submitted
- **WHEN** a user submits the configured access passphrase
- **THEN** the system grants access to the company research workflow for a bounded period

#### Scenario: Incorrect passphrase is submitted
- **WHEN** a user submits a passphrase that does not match the configured one
- **THEN** the system denies access and does not generate a brief

#### Scenario: Access control is not configured
- **WHEN** no access passphrase is configured
- **THEN** the system denies all access rather than admitting everyone

#### Scenario: Unauthenticated request reaches a protected route
- **WHEN** a request without a valid session reaches the brief workflow or the brief API
- **THEN** the system refuses it before any research provider call is made

#### Scenario: Session credential is tampered with
- **WHEN** a request presents a session credential that has been altered or has expired
- **THEN** the system treats it as unauthenticated

### Requirement: Company brief request
The system SHALL allow an authenticated user to request a preparation brief by entering a company name.

#### Scenario: User requests a company brief
- **WHEN** the user submits a non-empty company name
- **THEN** the system creates a preparation brief request for that company

#### Scenario: User submits an empty company name
- **WHEN** the user submits an empty or whitespace-only company name
- **THEN** the system rejects the request and asks for a valid company name

### Requirement: Sector classification
The system SHALL classify each company into an MBA-relevant sector or role family, SHALL present the classification to the user, and SHALL use it to select which deep-dive sections the brief contains.

Supported classifications are consulting, FMCG, BFSI, tech, conglomerate, and other.

#### Scenario: Company is classified
- **WHEN** research completes for a company
- **THEN** the brief states the sector it was classified into and presents that sector's deep-dive sections

#### Scenario: Classification is uncertain
- **WHEN** available evidence does not clearly place the company in one sector
- **THEN** the brief presents the classification as a likely classification, or falls back to the general deep dive, rather than asserting a sector confidently

### Requirement: Structured preparation brief
The system SHALL present each completed brief in clearly separated sections for company overview, recent news, the sector-specific deep dive, interview talking points, and questions to ask the interviewer.

#### Scenario: Brief is generated
- **WHEN** company research completes successfully
- **THEN** the system displays the brief with all required preparation sections for the classified sector

### Requirement: Recent news summary
The system SHALL include 3 to 5 recent news or noteworthy business updates when available, prioritizing items useful for placement interview preparation over raw recency alone.

#### Scenario: Recent news is available
- **WHEN** recent company news is found
- **THEN** the brief lists 3 to 5 concise news summaries with source references, publication dates, and why each item matters for interview preparation

#### Scenario: More than five news items are available
- **WHEN** more than five recent company news items are found
- **THEN** the brief selects the items with the highest placement usefulness rather than selecting only the newest items

#### Scenario: Recent news is unavailable
- **WHEN** no relevant recent company news is found
- **THEN** the brief states that no recent relevant news was found instead of inventing updates

#### Scenario: Noisy news items are found
- **WHEN** search results include low-value stock movement, generic CSR, old press releases, or wrong-company matches
- **THEN** the brief filters or de-emphasizes those items unless they are clearly relevant to placement interview preparation

### Requirement: Sector-specific deep dive
The system SHALL include a deep-dive section matched to the company's classified sector, covering the themes that sector's interviews typically probe.

#### Scenario: Consulting company deep dive
- **WHEN** the company is classified as consulting
- **THEN** the brief covers recent engagements or client and deal signals, practice areas, and how the firm positions itself against peer firms, with source references where the claims are factual

#### Scenario: BFSI company deep dive
- **WHEN** the company is classified as BFSI
- **THEN** the brief covers regulatory developments, the recent financial performance arc, and digital or product strategy

#### Scenario: Tech company deep dive
- **WHEN** the company is classified as tech
- **THEN** the brief covers product direction, competitive moat, and monetization or platform strategy

#### Scenario: Conglomerate deep dive
- **WHEN** the company is classified as a conglomerate
- **THEN** the brief covers group structure, capital allocation, and business unit priorities

#### Scenario: Deep-dive evidence is unavailable
- **WHEN** reliable evidence for the sector deep dive cannot be found
- **THEN** the brief states what could not be established instead of inventing detail

### Requirement: Conditional 4P analysis
The system SHALL provide a 4P analysis covering Product, Price, Place, and Promotion for sectors where marketing framing is interview-relevant, and SHALL omit it for sectors where it is not.

#### Scenario: Marketing-relevant sector
- **WHEN** the company is classified as FMCG or another sector where marketing framing drives the interview
- **THEN** the brief includes a full 4P analysis

#### Scenario: Sector where 4P does not apply
- **WHEN** the company is classified as BFSI or another sector where 4P adds little interview value
- **THEN** the brief omits the 4P section rather than filling it with generic industry-level content

#### Scenario: 4P applies but company detail is limited
- **WHEN** 4P applies to the sector but company-specific information is insufficient for one or more categories
- **THEN** the brief uses relevant industry-level analysis and labels the inference clearly

### Requirement: Interview talking points
The system SHALL generate 5 concise interview talking points that help the student connect company research to placement interview answers.

#### Scenario: Talking points are generated
- **WHEN** the brief includes sufficient company research or industry context
- **THEN** the brief provides 5 talking points suitable for answers such as why the student is interested in the company

#### Scenario: Talking points use limited evidence
- **WHEN** company-specific evidence is limited
- **THEN** the brief bases talking points on available sourced facts and clearly labeled industry context

### Requirement: Interviewer questions
The system SHALL generate 3 thoughtful questions the student can ask an interviewer, based on the company brief.

#### Scenario: Questions are generated
- **WHEN** the brief is generated successfully
- **THEN** the brief includes 3 questions that are relevant to the company, its sector, or the recent research context

#### Scenario: Questions avoid unsupported claims
- **WHEN** the brief contains limited or uncertain research
- **THEN** the questions avoid presenting unsupported facts as assumptions

### Requirement: Source transparency
The system SHALL distinguish sourced facts from generated analysis or inferred industry context.

#### Scenario: Brief includes factual claims
- **WHEN** the brief presents recent news, deals, partnerships, financial results, or other company facts
- **THEN** those claims include source references or are clearly marked as unavailable

#### Scenario: Brief includes analysis
- **WHEN** the brief presents 4P analysis, sector deep-dive interpretation, or preparation guidance
- **THEN** the brief identifies analysis or inference separately from sourced facts

### Requirement: Provider failure handling
The system SHALL handle research provider errors, rate limiting, and empty results without fabricating brief content. An infrastructure-class provider failure (rate limiting, a provider error, or an unparseable response) SHALL first be retried through the fallback provider per the `research-provider-fallback` capability before being reported to the user.

#### Scenario: Provider is rate limited or unavailable and no fallback succeeds
- **WHEN** the research provider returns an error or rate-limit response and either no fallback is configured or the fallback attempt also fails
- **THEN** the system reports that research could not be completed and invites the user to retry, rather than returning a brief built without evidence

### Requirement: Provider credentials are resolved per request

The system SHALL select the Gemini API key used to generate a brief based on the requesting session's role, per the `session-gemini-key` capability, rather than always using one server-wide key.

#### Scenario: Brief generation for an admin session
- **WHEN** an authenticated `admin` session requests a brief
- **THEN** the system generates the brief using the server's configured Gemini API key

#### Scenario: Brief generation for a non-admin session
- **WHEN** an authenticated non-admin session requests a brief
- **THEN** the system generates the brief using that session's own Gemini API key

