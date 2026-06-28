## MODIFIED Requirements

### Requirement: Rider reports delivery failure

The system SHALL allow an active rider to report delivery failure for a parcel assigned to their rider profile when the parcel status is `on_the_way`.

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
- **THEN** the system clears `parcels.delivery_failure_note`
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

#### Scenario: Unauthorized failure note deletion is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `on_the_way` status submits a delete failure note request
- **THEN** the system rejects the request without changing parcel data

### Requirement: Delivered parcel financial items are generated

The system SHALL preserve the rider delivery-attempt payout item and avoid duplicate rider payout financial items when a rider successfully marks a parcel delivered.

#### Scenario: COD delivered parcel preserves attempt payout item

- **WHEN** an active rider marks their assigned COD `on_the_way` parcel delivered with a valid proof photo after starting delivery
- **THEN** the system does not create a duplicate `rider_way_payout` financial item
- **AND** the existing `delivery_attempt` rider way payout item remains `pending`, has `amount = 1`, and remains linked to the rider assigned for the attempt
- **AND** the system does not create a `cod_remit` financial item until office cash handover is confirmed

#### Scenario: Non-COD delivered parcel preserves attempt payout item

- **WHEN** an active rider marks their assigned non-COD `on_the_way` parcel delivered with a valid proof photo after starting delivery
- **THEN** the system does not create a duplicate `rider_way_payout` financial item
- **AND** the existing `delivery_attempt` rider way payout item remains `pending`, has `amount = 1`, and remains linked to the rider assigned for the attempt
- **AND** the system does not create a `cod_remit` financial item

#### Scenario: Delivery completion is atomic

- **WHEN** any required parcel update or financial item consistency check fails during mark delivered
- **THEN** the system does not persist a partially delivered parcel state
- **AND** the system does not persist partial financial item changes

