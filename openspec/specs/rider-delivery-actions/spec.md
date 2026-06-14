# rider-delivery-actions Specification

## Purpose
TBD - created by archiving change rider-delivery-actions. Update Purpose after archive.
## Requirements
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

#### Scenario: Failure report has no delivery side effects

- **WHEN** a rider reports delivery failure for an assigned `on_the_way` parcel
- **THEN** the system does not set `delivered_at`
- **AND** the system does not update `collected_amount`
- **AND** the system does not create merchant settlement financial items
- **AND** the system does not create rider payout financial items

#### Scenario: Unauthorized failure report is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `on_the_way` status submits a failure report
- **THEN** the system rejects the request without changing parcel data

#### Scenario: Unauthorized failure note deletion is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `on_the_way` status submits a delete failure note request
- **THEN** the system rejects the request without changing parcel data

### Requirement: Rider marks parcel delivered with proof

The system SHALL allow an active rider to mark an assigned `on_the_way` parcel as `delivered` only after providing delivery proof photo data.

#### Scenario: Mark delivered is unavailable while failure note exists

- **WHEN** an assigned `on_the_way` parcel has a stored `delivery_failure_note`
- **THEN** the expanded rider parcel card does not show `Mark Delivered`

#### Scenario: Rider opens mark delivered dialog

- **WHEN** a rider expands an assigned `on_the_way` parcel card and clicks `Mark Delivered`
- **THEN** the system displays a shadcn dialog showing the collection amount for that parcel
- **AND** the dialog includes a delivery proof photo upload control

#### Scenario: Mobile proof capture uses camera-first input

- **WHEN** the delivery proof upload control is used on a compatible mobile browser
- **THEN** the system allows the rider to open the phone camera and capture a photo directly
- **AND** the captured photo appears in the dialog before submission

#### Scenario: Desktop proof upload remains available

- **WHEN** the delivery proof upload control is used on a desktop browser or a mobile browser without camera capture support
- **THEN** the system allows selecting an image file from the device
- **AND** the selected image appears in the dialog before submission

#### Scenario: Delivery proof is required

- **WHEN** a rider submits the mark delivered dialog without an image proof
- **THEN** the system rejects the request and displays a validation error without changing parcel data

#### Scenario: Unauthorized delivery completion is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `on_the_way` status submits a mark delivered request
- **THEN** the system rejects the request without changing parcel data or creating financial items

### Requirement: Delivered parcel state is persisted

The system SHALL persist successful rider delivery completion by updating the parcel status, proof, collection fields, and timestamps.

#### Scenario: COD parcel is delivered

- **WHEN** an active rider marks their assigned COD `on_the_way` parcel delivered with a valid proof photo
- **THEN** the system sets `parcels.status` to `delivered`
- **AND** the system stores the delivery proof object key in `parcels.proof_of_delivery_images_keys`
- **AND** the system sets `parcels.delivered_at`
- **AND** the system sets `parcels.collected_at`
- **AND** the system sets `parcels.cod_status` to `collected`
- **AND** the system sets `parcels.delivery_fee_status` to `collected`
- **AND** the system sets `parcels.is_received_by_office` to `false`
- **AND** the system sets `parcels.collected_amount` to `cod_amount + delivery_fee`
- **AND** the system sets `parcels.merchant_settlement_status` to `pending`
- **AND** the system sets `parcels.rider_payout_status` to `pending`

#### Scenario: Non-COD parcel is delivered

- **WHEN** an active rider marks their assigned non-COD `on_the_way` parcel delivered with a valid proof photo
- **THEN** the system sets `parcels.status` to `delivered`
- **AND** the system stores the delivery proof object key in `parcels.proof_of_delivery_images_keys`
- **AND** the system sets `parcels.delivered_at`
- **AND** the system sets `parcels.collected_at`
- **AND** the system sets `parcels.cod_status` to `not_applicable`
- **AND** the system sets `parcels.delivery_fee_status` to `collected`
- **AND** the system sets `parcels.is_received_by_office` to `false`
- **AND** the system sets `parcels.collected_amount` to `delivery_fee`
- **AND** the system sets `parcels.rider_payout_status` to `pending`

### Requirement: Delivered parcel financial items are generated

The system SHALL generate pending financial items when a rider successfully marks a parcel delivered.

#### Scenario: COD delivered parcel creates settlement and payout items

- **WHEN** an active rider marks their assigned COD `on_the_way` parcel delivered with a valid proof photo
- **THEN** the system creates one `financial_items` row with `item_type = cod_remit`, `amount = parcel.cod_amount`, `status = pending`, `merchant_id = parcel.merchant_id`, and `parcel_id = parcel.id`
- **AND** the system creates one `financial_items` row with `item_type = rider_way_payout`, `amount = 1`, `status = pending`, `merchant_id = parcel.merchant_id`, `rider_id = parcel.rider_id`, and `parcel_id = parcel.id`

#### Scenario: Non-COD delivered parcel creates only payout item

- **WHEN** an active rider marks their assigned non-COD `on_the_way` parcel delivered with a valid proof photo
- **THEN** the system does not create a `cod_remit` financial item
- **AND** the system creates one `financial_items` row with `item_type = rider_way_payout`, `amount = 1`, `status = pending`, `merchant_id = parcel.merchant_id`, `rider_id = parcel.rider_id`, and `parcel_id = parcel.id`

#### Scenario: Delivery completion is atomic

- **WHEN** any required parcel update or financial item creation fails during mark delivered
- **THEN** the system does not persist a partially delivered parcel state
- **AND** the system does not persist partial financial item rows

### Requirement: Delivery action storage fields exist

The system SHALL provide parcel storage fields for rider delivery failure notes and delivery proof image keys.

#### Scenario: Failure note column is available

- **WHEN** the application persists a rider failure report
- **THEN** the `parcels` table has a nullable text `delivery_failure_note` column available through the Drizzle schema

#### Scenario: Delivery proof keys column is available

- **WHEN** the application persists delivery proof after mark delivered
- **THEN** the `parcels` table has a JSON image key collection column available through the Drizzle schema
- **AND** the application stores object storage keys rather than public raw URLs

