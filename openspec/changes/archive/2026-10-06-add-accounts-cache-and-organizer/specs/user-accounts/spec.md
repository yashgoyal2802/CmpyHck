## Purpose

Give each user of the application their own login, so that data specific to one person - preparation status, interview dates, confidence ratings - can be stored and shown only to them, without adopting an external identity provider.

## ADDED Requirements

### Requirement: Owner-provisioned accounts
The system SHALL authenticate users against a set of accounts provisioned by the application owner and SHALL NOT offer self-service account registration.

#### Scenario: Owner provisions an account
- **WHEN** the owner creates an account with a username and password
- **THEN** that username and password can be used to log in, and no other route allows creating an account

#### Scenario: No public registration
- **WHEN** any unauthenticated visitor attempts to create an account through the application itself
- **THEN** the system provides no such capability

### Requirement: Username and password login
The system SHALL allow a user to authenticate with a username and password and SHALL grant a session on success.

#### Scenario: Correct credentials
- **WHEN** a user submits a username and password matching a provisioned account
- **THEN** the system grants that user a session scoped to their account for a bounded period

#### Scenario: Incorrect credentials
- **WHEN** a user submits a username and password that do not match any provisioned account
- **THEN** the system denies the login and does not grant a session

#### Scenario: No accounts provisioned
- **WHEN** no accounts have been provisioned
- **THEN** the system denies all login attempts rather than admitting everyone

### Requirement: Passwords are never stored or compared in plain text
The system SHALL store passwords only in hashed form and SHALL NOT log, echo, or transmit a submitted password in plain text beyond what is required to check it against the stored hash.

#### Scenario: Password storage
- **WHEN** an account's password is provisioned or changed
- **THEN** the system stores only a hash of it, never the plain-text value

### Requirement: Sessions identify the account, not just "authorized"
The system SHALL carry the authenticated account's identity in the session, so that downstream requests can be scoped to that specific user.

#### Scenario: Session identifies the user
- **WHEN** a request carries a valid session
- **THEN** the system can determine which provisioned account that session belongs to

#### Scenario: Session credential is tampered with or expired
- **WHEN** a request presents a session credential that has been altered or has expired
- **THEN** the system treats it as unauthenticated

### Requirement: Password reset is owner-mediated
The system SHALL NOT provide a self-service password reset flow; a forgotten password is reset by the owner provisioning a new one for that account.

#### Scenario: User forgets their password
- **WHEN** a user cannot log in because they have forgotten their password
- **THEN** the system offers no self-service recovery, and the account's password must be reset by the owner
