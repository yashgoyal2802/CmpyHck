# user-roles Specification

## Purpose

Determine which pages and data an account can reach, using a small fixed set of roles rather than a general permission system, so a narrower account (e.g. search-only access) can be provisioned without exposing the personal organizer, comparison tool, or saved list.

## Requirements

### Requirement: Every account has exactly one role
The system SHALL assign every account exactly one role from a fixed set: `admin`, `standard`, or `search_only`.

#### Scenario: Role set at provisioning
- **WHEN** the owner provisions an account
- **THEN** that account is assigned one of the three roles

#### Scenario: Existing accounts default to standard
- **WHEN** an account provisioned before roles existed is encountered
- **THEN** the system treats it as having the `standard` role rather than leaving it without one

### Requirement: search_only accounts are restricted to the search page
The system SHALL allow a `search_only` account to search a company and view its brief, and SHALL deny that account access to the organizer, comparison, and saved-companies capabilities, including their underlying data.

#### Scenario: search_only reaches the search page
- **WHEN** a `search_only` account requests the search page
- **THEN** the system serves it normally

#### Scenario: search_only is denied the organizer, compare, or saved pages
- **WHEN** a `search_only` account requests the organizer page, the comparison page, or the saved-companies page
- **THEN** the system denies the request rather than serving it

#### Scenario: search_only is denied the underlying data, not just the page
- **WHEN** a `search_only` account makes a request directly against the organizer or comparison data (bypassing the page)
- **THEN** the system denies that request on the same terms as the page

### Requirement: admin and standard accounts have full access
The system SHALL grant both `admin` and `standard` accounts access to every page and capability available to a signed-in user, with no distinction between them in this change beyond the `admin` designation itself.

#### Scenario: standard account reaches every page
- **WHEN** a `standard` account requests the search, organizer, compare, or saved-companies page
- **THEN** the system serves each of them normally

#### Scenario: admin account reaches every page
- **WHEN** an `admin` account requests the search, organizer, compare, or saved-companies page
- **THEN** the system serves each of them normally

### Requirement: A role change takes effect no later than next login
The system SHALL apply a role change to an account no later than that account's next login; an already-active session SHALL NOT be required to reflect the change any sooner.

#### Scenario: Role changed while a session is active
- **WHEN** an account's role is changed while that account has an active session
- **THEN** the system is not required to apply the new role's access until that account's next login
