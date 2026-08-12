## MODIFIED Requirements

### Requirement: Track preparation status per company
The system SHALL let a user set a company's preparation status to one of: tracking, prepping, interview scheduled, interviewed, offer, or not selected, independent of other users' status for that same company. The system SHALL only change status when the user explicitly sets it; it SHALL NOT infer or transition status automatically from other data such as the interview date.

#### Scenario: Set a company's preparation status
- **WHEN** a user sets a status for a company they are tracking
- **THEN** that status is recorded for that user and that company, and is visible only to them

#### Scenario: Two users track the same company independently
- **WHEN** two different users each set a status for the same company
- **THEN** each user's status for that company is independent of the other's

#### Scenario: Status does not change on its own
- **WHEN** a user sets an interview date for a tracked company without explicitly changing its status
- **THEN** the company's preparation status remains whatever it was, unchanged

#### Scenario: Status is editable from the organizer list
- **WHEN** a user views their organizer list of tracked companies
- **THEN** they can change any listed company's preparation status directly from that list, without navigating to the company's brief page

#### Scenario: Status is editable from a company's brief page
- **WHEN** a user views a company's brief page
- **THEN** they can change that company's preparation status from the brief page's tracking panel

#### Scenario: Existing preparation data is preserved as tracking or prepping
- **WHEN** the system encounters a company previously recorded as prepped
- **THEN** it presents that company's status as prepping
- **WHEN** the system encounters a company previously recorded as not prepped
- **THEN** it presents that company's status as tracking
