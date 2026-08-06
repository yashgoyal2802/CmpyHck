## Purpose

Let a user privately track their own placement preparation progress - which companies they have prepped, when the interview is, and how confident they feel - separately from the shared, factual company brief content.

## ADDED Requirements

### Requirement: Organizer entries are private to the account that made them
The system SHALL scope every organizer entry to the account that created it and SHALL NOT show one user's organizer entries to another user.

#### Scenario: Another user cannot see my organizer entries
- **WHEN** a different user views the application
- **THEN** they do not see any organizer entry created by another account

### Requirement: Track preparation status per company
The system SHALL let a user mark a company as prepped or not prepped, independent of other users' status for that same company.

#### Scenario: Mark a company prepped
- **WHEN** a user marks a company as prepped
- **THEN** that status is recorded for that user and that company, and is visible only to them

#### Scenario: Two users track the same company independently
- **WHEN** two different users each track the same company
- **THEN** each user's prepped status for that company is independent of the other's

### Requirement: Track an interview date per company
The system SHALL let a user record an interview date for a company they are tracking, and SHALL allow it to be left unset.

#### Scenario: Set an interview date
- **WHEN** a user sets an interview date for a tracked company
- **THEN** that date is recorded for that user and that company

#### Scenario: Interview date left unset
- **WHEN** a user tracks a company without setting an interview date
- **THEN** the system accepts the entry with no date, rather than requiring one

### Requirement: Track a confidence rating per company
The system SHALL let a user record a confidence rating for a company they are tracking.

#### Scenario: Set a confidence rating
- **WHEN** a user sets a confidence rating for a tracked company
- **THEN** that rating is recorded for that user and that company

### Requirement: Organizer entries reference companies without duplicating brief content
The system SHALL store organizer entries as a reference to a company plus the user's own tracking data, and SHALL NOT duplicate the company's cached research facts into the organizer entry.

#### Scenario: Viewing a tracked company
- **WHEN** a user views their organizer
- **THEN** the tracking data shown (status, date, confidence) comes from the organizer entry, and any company research shown alongside it is read from the shared company research rather than a private copy
