# company-comparison Specification

## Purpose

Let a user see two or three companies' briefs side by side, to support choosing between shortlisted companies rather than only preparing for one at a time.

## Requirements

### Requirement: Compare two or three companies at once
The system SHALL let a user select two or three companies and SHALL present a brief for each side by side in one view.

#### Scenario: Compare two companies
- **WHEN** a user selects two companies to compare
- **THEN** the system presents both companies' briefs side by side

#### Scenario: Compare three companies
- **WHEN** a user selects three companies to compare
- **THEN** the system presents all three companies' briefs side by side

#### Scenario: Fewer than two or more than three companies selected
- **WHEN** a user attempts to compare fewer than two or more than three companies
- **THEN** the system rejects the request and asks for two or three companies

### Requirement: Comparison reuses the standard brief generation
The system SHALL generate each company's brief in a comparison using the same research and structuring behavior as a single-company brief request, including sector classification, conditional 4P, and cache reuse where applicable.

#### Scenario: A compared company has a warm cache entry
- **WHEN** one of the companies selected for comparison already has a valid cached entry
- **THEN** that company's brief reuses the cached facts exactly as a standalone search would

#### Scenario: A compared company has no cache entry
- **WHEN** one of the companies selected for comparison has no cached entry
- **THEN** that company's brief is researched in full, exactly as a standalone search would

### Requirement: One company's failure does not block the others
The system SHALL generate each company's brief in a comparison independently, such that a failure researching one company does not prevent the others from being shown.

#### Scenario: One company fails to research
- **WHEN** one of the companies selected for comparison cannot be researched (for example, no results found)
- **THEN** the system still presents the successfully generated briefs for the other companies, with the failed one shown as unavailable
