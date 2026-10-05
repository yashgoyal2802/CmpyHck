## ADDED Requirements

### Requirement: Provider credentials are resolved per request

The system SHALL select the Gemini API key used to generate a brief based on the requesting session's role, per the `session-gemini-key` capability, rather than always using one server-wide key.

#### Scenario: Brief generation for an admin session
- **WHEN** an authenticated `admin` session requests a brief
- **THEN** the system generates the brief using the server's configured Gemini API key

#### Scenario: Brief generation for a non-admin session
- **WHEN** an authenticated non-admin session requests a brief
- **THEN** the system generates the brief using that session's own Gemini API key
