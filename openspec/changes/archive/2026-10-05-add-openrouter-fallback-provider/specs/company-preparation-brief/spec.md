## MODIFIED Requirements

### Requirement: Provider failure handling
The system SHALL handle research provider errors, rate limiting, and empty results without fabricating brief content. An infrastructure-class provider failure (rate limiting, a provider error, or an unparseable response) SHALL first be retried through the fallback provider per the `research-provider-fallback` capability before being reported to the user.

#### Scenario: Provider is rate limited or unavailable and no fallback succeeds
- **WHEN** the research provider returns an error or rate-limit response and either no fallback is configured or the fallback attempt also fails
- **THEN** the system reports that research could not be completed and invites the user to retry, rather than returning a brief built without evidence
