## Purpose

Lets non-admin accounts supply their own Gemini API key at login so their brief-generation usage is billed against their own free-tier quota rather than the owner's, while keeping that key scoped to the session that supplied it rather than the shared account.

## ADDED Requirements

### Requirement: Non-admin login requires a Gemini API key

The system SHALL require a Gemini API key as part of the sign-in form for any account whose role is not `admin`, in addition to username and password. The system SHALL NOT start a session for a non-admin account when the key field is empty or missing.

#### Scenario: Non-admin submits username, password, and a key
- **WHEN** a `standard` or `search_only` account submits a valid username, matching password, and a non-empty Gemini API key
- **THEN** the system starts a session carrying that key

#### Scenario: Non-admin omits the key
- **WHEN** a `standard` or `search_only` account submits a valid username and matching password but leaves the Gemini API key field empty
- **THEN** the system rejects the sign-in attempt and does not start a session, even though the username and password were correct

#### Scenario: Admin login does not require a key
- **WHEN** an `admin` account submits a valid username and matching password
- **THEN** the system starts a session without requiring or collecting a Gemini API key

### Requirement: Distinct failure message for a missing key

The system SHALL show a different sign-in failure message when the username and password are correct but the Gemini API key is missing than when the username or password itself is wrong. This does not weaken the existing single generic message for a bad username/password - that stays undifferentiated. The key-required message only fires after credentials are already confirmed correct, so it is not a vector for guessing which part of a credential pair is wrong.

#### Scenario: Correct credentials, missing key
- **WHEN** a non-admin account submits a correct username and password but an empty Gemini API key
- **THEN** the sign-in failure message tells the user their Gemini API key is required, not that their username/password was rejected

#### Scenario: Incorrect credentials
- **WHEN** a sign-in attempt submits a username or password that does not match a provisioned account
- **THEN** the sign-in failure message is the existing generic "username and password were not accepted" message, regardless of what was submitted in the key field

### Requirement: Session-scoped key, not account-scoped

The system SHALL store a non-admin session's submitted Gemini API key only on that session's credential, and SHALL NOT write it to the account record or any other storage shared across sessions.

#### Scenario: Key is not persisted to the account
- **WHEN** a non-admin account signs in with a Gemini API key
- **THEN** the account's stored record is unchanged by that key - a later read of the account does not expose it

#### Scenario: Two concurrent sessions on the same shared account use their own keys
- **WHEN** two sessions are independently signed into the same non-admin account at the same time, each having submitted a different Gemini API key
- **THEN** each session's brief-generation requests use the key that session submitted, and neither session's key is overwritten or replaced by the other's

### Requirement: Request-time key resolution

The system SHALL resolve the Gemini API key used for a brief-generation request from the requesting session: the server's own configured key for an `admin` session, and the session's submitted key for a non-admin session.

#### Scenario: Admin request uses the server's key
- **WHEN** an authenticated `admin` session requests a brief
- **THEN** the system generates it using the server-configured Gemini API key, not any session-supplied key

#### Scenario: Non-admin request uses its session's key
- **WHEN** an authenticated non-admin session requests a brief
- **THEN** the system generates it using the Gemini API key that session supplied at login

#### Scenario: Session's key is rejected by the provider
- **WHEN** a non-admin session's Gemini API key is invalid or rejected by the provider
- **THEN** the system reports a provider configuration error for that request rather than falling back to the server's own key
