## Purpose

Lets a visitor browse the app's UI and a fixture-backed search experience without creating an account, signing in, or triggering any real research-provider call or database write, so deciding whether to ask for a real account costs nothing.

## ADDED Requirements

### Requirement: Starting a demo session requires no credentials

The system SHALL let a visitor start a demo session from the sign-in page without submitting a username, password, or any other credential, and SHALL NOT create or modify any account record as a result.

#### Scenario: Visitor starts a demo session
- **WHEN** a visitor activates the sign-in page's demo entry point
- **THEN** the system starts a session for that visitor without asking for or validating any credential, and no row is created in the accounts store

### Requirement: Demo sessions can reach every page

The system SHALL allow a demo session to reach the search, saved, organizer, and compare pages without being redirected to sign-in, the same as a real account.

#### Scenario: Demo session visits a gated page
- **WHEN** a demo session requests the search, saved, organizer, or compare page
- **THEN** the system serves that page rather than redirecting to sign-in

### Requirement: Demo search is fixture-backed only

The system SHALL resolve a demo session's company search only against the application's existing fixture companies, and SHALL NOT make a real research-provider call for a demo session under any circumstance.

#### Scenario: Demo session searches a fixture company
- **WHEN** a demo session submits the name of a company present in the application's fixtures
- **THEN** the system returns that fixture's brief content, without calling a real research provider

#### Scenario: Demo session searches an unrecognized company
- **WHEN** a demo session submits a company name that is not one of the application's fixtures
- **THEN** the system shows its existing no-results outcome, not an error, and still makes no real research-provider call

#### Scenario: Demo session's suggested companies are searchable
- **WHEN** the search page renders for a demo session
- **THEN** the companies it suggests to search are drawn from the application's fixtures, not the real-account suggestions

### Requirement: Demo saved page is frozen

The system SHALL show a demo session's saved-companies page as a fixed, pre-populated state - one fixture company already bookmarked - rather than reading from or writing to real per-account organizer storage.

#### Scenario: Demo session views the saved page
- **WHEN** a demo session requests the saved-companies page
- **THEN** the system shows one fixture company already bookmarked, the same on every visit within the session

### Requirement: Demo organizer and compare actions are disabled

The system SHALL render the organizer and compare pages normally for a demo session, but SHALL disable every action that would create, modify, or compare real data, presenting a sign-in prompt in place of performing the action. The system SHALL also reject such an action at the API level if attempted directly, independent of the UI.

#### Scenario: Demo session views the organizer or compare page
- **WHEN** a demo session requests the organizer or compare page
- **THEN** the system renders the page's normal layout with its action controls visibly disabled and a prompt to sign in to use them

#### Scenario: Demo session attempts a write via the API directly
- **WHEN** a demo session's request reaches an endpoint that would create or modify organizer data, or run a real comparison
- **THEN** the system rejects the request rather than performing it, regardless of what the UI would have allowed

### Requirement: Demo session is visibly indicated

The system SHALL show a persistent indicator throughout a demo session that it is a demo, with a path back to the real sign-in page.

#### Scenario: Demo session browses any page
- **WHEN** a demo session is active on any page
- **THEN** the system shows a visible indicator that this is a demo, with a way to reach the real sign-in page

### Requirement: Demo sessions are exempt from the Gemini-key requirement

The system SHALL NOT require a demo session to carry a Gemini API key, and SHALL NOT treat a demo session as unauthenticated for lacking one, even though a demo session is not an `admin` session.

#### Scenario: Demo session has no Gemini API key
- **WHEN** a demo session (which never carries a Gemini API key) reaches a route that otherwise requires a non-admin session to carry one
- **THEN** the system treats the demo session as authenticated and does not redirect it to sign-in
