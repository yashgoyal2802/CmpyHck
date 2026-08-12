## Purpose

Give a reader an at-a-glance visual summary of a company brief's shape and trustworthiness before they read the full prose, and ensure every brief includes exactly one strategic-analysis framework suited to its sector.

## ADDED Requirements

### Requirement: Brief summary overview
The system SHALL present a summary of each generated brief showing, at minimum, the company's classified sector, the classification's confidence, the proportion of claims backed by a source versus generated analysis, the total number of distinct sources cited, and the number of talking points and interviewer questions available — all derived from data already present in the brief, without generating any new content for the summary itself.

#### Scenario: Summary reflects a fully-sourced brief
- **WHEN** a brief is generated where most claims are sourced
- **THEN** the summary reflects a high sourced-to-analysis proportion

#### Scenario: Summary reflects a mostly-inferred brief
- **WHEN** a brief is generated where evidence was limited and most claims are inferred
- **THEN** the summary reflects a low sourced-to-analysis proportion rather than overstating the brief's evidentiary basis

### Requirement: Exactly one strategic framework per brief
The system SHALL include exactly one strategic-analysis framework section in every brief: a 4P analysis for sectors where marketing framing drives the interview, and a Porter's Five Forces analysis for every other sector. The system SHALL NOT include both in the same brief, and SHALL NOT omit a framework entirely.

#### Scenario: Marketing-relevant sector gets 4P
- **WHEN** the company is classified into a sector where 4P analysis applies
- **THEN** the brief includes the 4P analysis and does not include a Five Forces analysis

#### Scenario: Non-marketing sector gets Five Forces
- **WHEN** the company is classified into a sector where 4P analysis does not apply
- **THEN** the brief includes a Porter's Five Forces analysis covering competitive rivalry, supplier power, buyer power, threat of substitutes, and threat of new entrants, and does not include a 4P analysis

#### Scenario: Five Forces evidence is limited
- **WHEN** company-specific information for one or more forces is insufficient
- **THEN** the brief uses relevant industry-level analysis for that force and labels it as inferred rather than sourced

#### Scenario: Five Forces claims are source-transparent
- **WHEN** the brief presents a Five Forces analysis
- **THEN** each force's claims are marked as sourced or inferred and carry source references where they are sourced, on the same terms as every other claim-bearing section of the brief
