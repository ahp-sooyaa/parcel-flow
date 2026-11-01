## MODIFIED Requirements

### Requirement: Rider reports delivery failure

The system SHALL allow an active rider to report delivery failure for a parcel assigned to their rider profile when the parcel status is `on_the_way`. The web rider page and the mobile API SHALL report, edit and delete failure notes through one shared operation per action, and each action SHALL lock the parcel row while it reads and writes the note.

#### Scenario: Rider opens failure dialog

- **WHEN** a rider expands an assigned `on_the_way` parcel card and clicks `Report Failure`
- **THEN** the system displays a shadcn dialog with a note textarea and submit action

#### Scenario: Failure note is required

- **WHEN** a rider submits the failure dialog without a non-empty note
- **THEN** the system rejects the request and displays a validation error without changing parcel data

#### Scenario: Failure report is saved

- **WHEN** an active rider submits a valid failure note for their assigned `on_the_way` parcel
- **THEN** the system stores the note in `parcels.delivery_failure_note`
- **AND** the parcel status remains `on_the_way`
- **AND** the rider assignment remains unchanged

#### Scenario: Failure note suppresses delivery outcome actions

- **WHEN** an assigned `on_the_way` parcel has a stored `delivery_failure_note`
- **THEN** the expanded rider parcel card does not show `Report Failure`
- **AND** the expanded rider parcel card does not show `Mark Delivered`
- **AND** the expanded rider parcel card shows an action to open the failure note dialog

#### Scenario: Rider views existing failure note

- **WHEN** a rider opens the failure note dialog for an assigned `on_the_way` parcel that has a stored failure note
- **THEN** the system displays the existing note in a shadcn dialog
- **AND** the rider can close the dialog without changing parcel data

#### Scenario: Rider edits existing failure note

- **WHEN** a rider changes the note text in the failure note dialog and submits it
- **THEN** the system updates `parcels.delivery_failure_note` with the new non-empty note
- **AND** the parcel status remains `on_the_way`
- **AND** the rider assignment remains unchanged

#### Scenario: Rider deletes existing failure note

- **WHEN** a rider clicks delete in the failure note dialog for their assigned `on_the_way` parcel
- **THEN** the system removes the active entry from `parcels.delivery_failure_note`, keeping inactive history entries
- **AND** the parcel status remains `on_the_way`
- **AND** the rider assignment remains unchanged
- **AND** the expanded rider parcel card can again show `Report Failure` and `Mark Delivered`

#### Scenario: Failure report has no additional delivery side effects

- **WHEN** a rider reports delivery failure for an assigned `on_the_way` parcel
- **THEN** the system does not set `delivered_at`
- **AND** the system does not update `collected_amount`
- **AND** the system does not create merchant settlement financial items
- **AND** the system does not create an additional rider payout financial item
- **AND** any existing pending `delivery_attempt` rider way payout item remains linked to the rider assigned for that attempt

#### Scenario: Unauthorized failure report is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `on_the_way` status submits a failure report
- **THEN** the system rejects the request without changing parcel data

#### Scenario: Unauthorized failure note update is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `on_the_way` status submits an update failure note request
- **THEN** the system rejects the request without changing parcel data

#### Scenario: Unauthorized failure note deletion is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `on_the_way` status submits a delete failure note request
- **THEN** the system rejects the request without changing parcel data

#### Scenario: Concurrent failure note writes are serialized

- **WHEN** a failure note delete runs at the same time as an edit, an admin failure resolution, or a delivery on the same parcel
- **THEN** the writes apply one after another under the parcel row lock, and neither silently overwrites the other's result

#### Scenario: Web and mobile share failure note rules

- **WHEN** a rider reports, edits, or deletes a failure note from the web rider page or the mobile app
- **THEN** the same validation, ownership, status and active-note rules apply, with the same messages
