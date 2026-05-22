## ADDED Requirements

### Requirement: Parcel failure notes are stored as status-tracked history
The system SHALL store parcel delivery failure notes in `parcels.delivery_failure_note` as a JSONB collection of note entries so the application can preserve multiple rider failure reports and track whether each entry is still active.

#### Scenario: Legacy text note is migrated into JSONB history
- **WHEN** a parcel already has a non-empty legacy text `delivery_failure_note` during the column migration
- **THEN** the system converts that value into a one-entry JSONB array containing the same note text
- **AND** the migrated entry status becomes `active` only when the parcel is still `on_the_way` with an assigned rider
- **AND** the migrated entry status becomes `inactive` for all other parcel states

#### Scenario: Rider failure report appends active note
- **WHEN** an active rider submits a new failure note for their assigned `on_the_way` parcel that has no active failure note
- **THEN** the system appends a new note entry to `parcels.delivery_failure_note`
- **AND** the appended entry stores the submitted note text
- **AND** the appended entry stores `status = active`
- **AND** the parcel status remains `on_the_way`

### Requirement: Rider delivery actions are gated by active failure note state
The system SHALL determine rider parcel actions from whether the parcel currently has an active failure note entry.

#### Scenario: Rider sees default actions when no active note exists
- **WHEN** a rider opens an assigned `on_the_way` parcel that has no active failure note
- **THEN** the parcel card shows `Report Failure`
- **AND** the parcel card shows `Mark Delivered`
- **AND** the parcel card does not show `View Failure Note`

#### Scenario: Rider sees review action when active note exists
- **WHEN** a rider opens an assigned `on_the_way` parcel that has an active failure note
- **THEN** the parcel card shows `View Failure Note`
- **AND** the parcel card does not show `Report Failure`
- **AND** the parcel card does not show `Mark Delivered`

#### Scenario: Rider can view active failure note details
- **WHEN** a rider clicks `View Failure Note` for a parcel with an active failure note
- **THEN** the system shows the active failure note content without changing parcel data

### Requirement: Admin failure resolution deactivates the active note
The system SHALL mark the current active failure note entry inactive when an admin resolves a failed delivery to `postpone` or `canceled_returned`.

#### Scenario: Postpone resolution deactivates active note
- **WHEN** a super admin or office admin resolves an eligible failed parcel to `postpone`
- **THEN** the system marks the parcel's active failure note entry as `inactive`
- **AND** the system sets the parcel status to `postpone`
- **AND** the system clears `rider_id`
- **AND** the system clears `assigned_at`

#### Scenario: Return resolution deactivates active note
- **WHEN** a super admin or office admin resolves an eligible failed parcel to `canceled_returned`
- **THEN** the system marks the parcel's active failure note entry as `inactive`
- **AND** the system sets the parcel status to `canceled_returned`
- **AND** the system clears `rider_id`
- **AND** the system clears `assigned_at`

#### Scenario: Resolution without active note is rejected
- **WHEN** a failure resolution request targets a parcel with no active failure note
- **THEN** the system rejects the request and leaves the parcel unchanged

### Requirement: Admin parcel list exposes unresolved failure review queue
The system SHALL provide an admin parcel-list filter for parcels that currently have an active failure note.

#### Scenario: Need review tab lists active-note parcels
- **WHEN** a super admin or office admin opens the `Need review` tab on the parcel listing page
- **THEN** the system shows only parcels that have an active failure note

#### Scenario: Resolved parcel leaves need review tab
- **WHEN** a parcel's active failure note is marked inactive by an admin failure resolution
- **THEN** that parcel no longer appears in the `Need review` tab

#### Scenario: Need review filter is hidden from non-admin users
- **WHEN** a rider or merchant opens a parcel listing surface
- **THEN** the system does not expose the admin `Need review` tab
