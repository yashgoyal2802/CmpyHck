## MODIFIED Requirements

### Requirement: Owner-provisioned accounts
The system SHALL authenticate users against a set of accounts provisioned by the application owner, SHALL NOT offer self-service account registration, and SHALL assign each provisioned account a role.

#### Scenario: Owner provisions an account
- **WHEN** the owner creates an account with a username and password
- **THEN** that username and password can be used to log in, and no other route allows creating an account

#### Scenario: Owner provisions an account with a role
- **WHEN** the owner creates an account and specifies a role
- **THEN** the account is created with that role

#### Scenario: Owner provisions an account without specifying a role
- **WHEN** the owner creates an account without specifying a role
- **THEN** the account is created with the `standard` role

#### Scenario: No public registration
- **WHEN** any unauthenticated visitor attempts to create an account through the application itself
- **THEN** the system provides no such capability

### Requirement: Sessions identify the account, not just "authorized"
The system SHALL carry the authenticated account's identity and role in the session, so that downstream requests can be scoped to that specific user and access can be determined without a separate lookup.

#### Scenario: Session identifies the user
- **WHEN** a request carries a valid session
- **THEN** the system can determine which provisioned account that session belongs to

#### Scenario: Session identifies the role
- **WHEN** a request carries a valid session
- **THEN** the system can determine that account's role without consulting anything beyond the session itself

#### Scenario: Session credential is tampered with or expired
- **WHEN** a request presents a session credential that has been altered or has expired
- **THEN** the system treats it as unauthenticated
