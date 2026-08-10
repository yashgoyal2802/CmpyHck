## Purpose

Let a user mark a researched company for quick, no-retyping return access, independently of whether they are actively tracking it for interview preparation.

## ADDED Requirements

### Requirement: Bookmark a company independently of preparation tracking
The system SHALL let a user bookmark or unbookmark a company they have researched, and SHALL NOT require or imply any change to that company's preparation status, interview date, or confidence rating when doing so.

#### Scenario: Bookmark a company with no existing tracking data
- **WHEN** a user bookmarks a company they have never tracked before
- **THEN** the system records the bookmark without setting a preparation status, interview date, or confidence rating

#### Scenario: Bookmark a company already being tracked
- **WHEN** a user bookmarks a company that already has preparation status, interview date, or confidence data recorded
- **THEN** the system adds the bookmark without altering that existing tracking data

#### Scenario: Unbookmark a company
- **WHEN** a user removes the bookmark from a company
- **THEN** the system stops listing that company among the user's bookmarks, and leaves any preparation tracking data for that company unchanged

### Requirement: Bookmarks are private to the account that made them
The system SHALL scope every bookmark to the account that created it and SHALL NOT show one user's bookmarks to another user.

#### Scenario: Another user cannot see my bookmarks
- **WHEN** a different user views the application
- **THEN** they do not see any bookmark created by another account

### Requirement: Browse bookmarked companies
The system SHALL let a user view a list of all companies they have bookmarked.

#### Scenario: Viewing bookmarks with saved companies
- **WHEN** a user with one or more bookmarked companies opens their bookmarks list
- **THEN** the system shows each bookmarked company's name

#### Scenario: Viewing bookmarks with none saved
- **WHEN** a user with no bookmarked companies opens their bookmarks list
- **THEN** the system shows that no companies are bookmarked yet, rather than an empty or broken view

### Requirement: Reopen a bookmarked company's brief without re-research when possible
The system SHALL let a user reopen a bookmarked company directly into that company's current brief, reusing cached research when it has not expired, and re-researching only when the cache is missing or expired.

#### Scenario: Reopen a bookmark within the cache window
- **WHEN** a user reopens a bookmarked company whose cached research has not expired
- **THEN** the system presents the brief from cache rather than re-researching the company

#### Scenario: Reopen a bookmark after the cache has expired
- **WHEN** a user reopens a bookmarked company whose cached research has expired or was never cached
- **THEN** the system re-researches the company in full, the same as a fresh search would

#### Scenario: Force a refresh from a reopened bookmark
- **WHEN** a user reopens a bookmarked company and then explicitly requests a fresh check
- **THEN** the system re-researches the company in full regardless of whether the cached entry has expired
