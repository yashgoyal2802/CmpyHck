## MODIFIED Requirements

### Requirement: Restricted access
The system SHALL restrict use to holders of a provisioned account authenticated by username and password, SHALL NOT offer public sign-up, and SHALL deny all access when no accounts are provisioned.

#### Scenario: Correct credentials are submitted
- **WHEN** a user submits a username and password matching a provisioned account
- **THEN** the system grants access to the company research workflow for a bounded period

#### Scenario: Incorrect credentials are submitted
- **WHEN** a user submits a username and password that do not match any provisioned account
- **THEN** the system denies access and does not generate a brief

#### Scenario: No accounts are provisioned
- **WHEN** no accounts have been provisioned
- **THEN** the system denies all access rather than admitting everyone

#### Scenario: Unauthenticated request reaches a protected route
- **WHEN** a request without a valid session reaches the brief workflow or the brief API
- **THEN** the system refuses it before any research provider call is made

#### Scenario: Session credential is tampered with
- **WHEN** a request presents a session credential that has been altered or has expired
- **THEN** the system treats it as unauthenticated
