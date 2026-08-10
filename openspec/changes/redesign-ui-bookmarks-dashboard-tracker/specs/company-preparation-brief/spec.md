## MODIFIED Requirements

### Requirement: Strategic framework analysis
The system SHALL provide exactly one strategic framework analysis in every brief: a 4P analysis (Product, Price, Place, Promotion) for sectors where marketing framing is interview-relevant, and a Porter's Five Forces analysis for every other sector. The system SHALL NOT provide both frameworks in the same brief, and SHALL NOT provide neither.

#### Scenario: Marketing-relevant sector
- **WHEN** the company is classified as FMCG or another sector where marketing framing drives the interview
- **THEN** the brief includes a full 4P analysis and no Five Forces analysis

#### Scenario: Sector where 4P does not apply
- **WHEN** the company is classified as BFSI or another sector where 4P adds little interview value
- **THEN** the brief includes a Porter's Five Forces analysis covering the company's competitive rivalry, supplier power, buyer power, threat of substitutes, and threat of new entrants, instead of a 4P section

#### Scenario: 4P applies but company detail is limited
- **WHEN** 4P applies to the sector but company-specific information is insufficient for one or more categories
- **THEN** the brief uses relevant industry-level analysis and labels the inference clearly

#### Scenario: Five Forces applies but company detail is limited
- **WHEN** Five Forces applies to the sector but company-specific information is insufficient for one or more forces
- **THEN** the brief uses relevant industry-level analysis for that force and labels the inference clearly
