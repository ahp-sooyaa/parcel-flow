# parcel-corrections Specification

## Purpose
TBD - created by archiving change add-parcel-corrections. Update Purpose after archive.
## Requirements
### Requirement: Admins can access parcel corrections from parcel detail

The system SHALL expose parcel correction controls from the parcel detail sheet only to super admins and office admins.

#### Scenario: Admin sees correction section

- **WHEN** a super admin or office admin opens a parcel detail sheet
- **THEN** the system shows a `Corrections` section
- **AND** the section provides actions to correct parcel status and correct rider assignment
- **AND** the section shows recent correction history for the parcel

#### Scenario: Non-admin cannot see correction controls

- **WHEN** a merchant or rider opens a parcel detail sheet
- **THEN** the system does not show parcel correction controls
- **AND** correction server actions reject any submitted request from that user

### Requirement: Parcel correction audit log is persisted

The system SHALL persist a correction log entry for every successful parcel correction.

#### Scenario: Status correction log is stored

- **WHEN** an authorized admin successfully corrects a parcel status
- **THEN** the system creates one `parcel_correction_logs` row for the parcel
- **AND** the log stores correction type `status`, old status, new status, actor, required reason, timestamp, and side-effect summary
- **AND** the system also writes a `parcel_status_logs` row for the status change
- **AND** the correction log links to the status log when the schema supports that relationship

#### Scenario: Rider correction log is stored

- **WHEN** an authorized admin successfully corrects a parcel rider
- **THEN** the system creates one `parcel_correction_logs` row for the parcel
- **AND** the log stores correction type `rider`, old rider, new rider, actor, required reason, timestamp, and side-effect summary

#### Scenario: Failed correction does not create audit log

- **WHEN** a correction request is rejected
- **THEN** the system does not create a `parcel_correction_logs` row
- **AND** the system does not create a `parcel_status_logs` row

### Requirement: Status corrections reconcile parcel lifecycle side effects

The system SHALL apply status corrections transactionally and reconcile parcel fields and eligible financial side effects for the target status.

#### Scenario: Delivered parcel is corrected away from delivered

- **WHEN** an authorized admin corrects a delivered parcel to a non-delivered status
- **THEN** the system clears delivered timestamp, collected timestamp, collected amount, office receipt confirmation, collection confirmer, and delivery proof references as required by the target state
- **AND** the system resets COD and delivery fee statuses according to the target state
- **AND** the system voids eligible pending `rider_way_payout` financial items for that parcel
- **AND** the system voids eligible pending `cod_remit` financial items for that parcel
- **AND** the system persists all changes atomically

#### Scenario: Returned parcel is corrected away from returned-to-merchant

- **WHEN** an authorized admin corrects a `returned_to_merchant` parcel to another status
- **THEN** the system clears `returned_to_merchant_at`
- **AND** the system resets delivery fee status according to the target state
- **AND** the system voids eligible pending `delivery_fee_deduction` financial items for that parcel
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to delivered

- **WHEN** an authorized admin corrects a parcel to `delivered`
- **THEN** the system requires the parcel to have an active assigned rider
- **AND** the system sets delivered timestamp, collected timestamp, collected amount, COD status, delivery fee status, office receipt state, settlement status, and payout status consistently
- **AND** the system creates any missing eligible pending delivered-side financial items without duplicating active financial items
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to returned-to-merchant

- **WHEN** an authorized admin corrects a parcel to `returned_to_merchant`
- **THEN** the system sets `returned_to_merchant_at`
- **AND** the system sets delivery fee status to `deduct_from_merchant`
- **AND** the system creates one eligible pending `delivery_fee_deduction` financial item if no active deduction item exists
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to at-office

- **WHEN** an authorized admin corrects a parcel to `at_office`
- **THEN** the system clears delivery, return, collection, office receipt, collection confirmer, and proof fields
- **AND** the system clears the current rider assignment by default
- **AND** the system resets COD and delivery fee statuses according to parcel type
- **AND** the system voids eligible pending financial items that belong to later lifecycle states
- **AND** the system does not create new financial items
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to on-the-way

- **WHEN** an authorized admin corrects a parcel to `on_the_way`
- **THEN** the system requires the parcel to have or receive an active assigned rider
- **AND** the system keeps or sets assignment timestamp consistently
- **AND** the system clears delivered, returned, collection, office receipt, collection confirmer, and proof fields from later lifecycle states
- **AND** the system voids eligible pending financial items that belong to delivered or returned lifecycle states
- **AND** the system does not create new financial items
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to postpone

- **WHEN** an authorized admin corrects a parcel to `postpone`
- **THEN** the system clears active delivery, delivery completion, return completion, collection, office receipt, collection confirmer, and proof fields
- **AND** the system clears the current rider assignment
- **AND** the system deactivates any active failure note that the correction resolves
- **AND** the system voids eligible pending financial items that are inconsistent with the postponed state
- **AND** the system does not create new financial items
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to canceled-returned

- **WHEN** an authorized admin corrects a parcel to `canceled_returned`
- **THEN** the system clears active delivery, delivery completion, return completion, collection, office receipt, collection confirmer, and proof fields
- **AND** the system clears rider assignment unless the admin explicitly keeps or selects an active rider for return handling
- **AND** the system deactivates any active failure note that the correction resolves
- **AND** the system voids eligible pending financial items that are inconsistent with the canceled-returned state
- **AND** the system does not create new financial items
- **AND** the system persists all changes atomically

#### Scenario: Non-financial status correction does not create financial side effects

- **WHEN** an authorized admin corrects between statuses that do not generate financial items by themselves, including `at_office`, `on_the_way`, `postpone`, and `canceled_returned`
- **THEN** the system updates parcel state and assignment fields required by the target status
- **AND** the system does not create `cod_remit`, `delivery_fee_deduction`, or `rider_way_payout` financial items solely because of that correction

### Requirement: Unsafe financial corrections are blocked

The system SHALL reject corrections that would silently mutate finalized or reserved financial records.

#### Scenario: Settled merchant financial item blocks correction

- **WHEN** a correction would void or change a `financial_items` row that is settled or linked to a settled merchant settlement
- **THEN** the system rejects the correction
- **AND** the parcel, financial items, settlement, payout, and logs remain unchanged

#### Scenario: In-progress merchant settlement item blocks correction

- **WHEN** a correction would void or change a `financial_items` row that is linked to an in-progress merchant settlement
- **THEN** the system rejects the correction
- **AND** the parcel, financial items, settlement, payout, and logs remain unchanged

#### Scenario: Rider payout item blocks correction

- **WHEN** a correction would void or change a `financial_items` row linked to an in-progress or settled rider payout
- **THEN** the system rejects the correction
- **AND** the parcel, financial items, payout, and logs remain unchanged

### Requirement: Rider corrections reconcile rider-owned side effects

The system SHALL allow admins to correct the assigned rider when the target state can remain consistent.

#### Scenario: Active delivery rider is corrected

- **WHEN** an authorized admin corrects the rider for a parcel in `at_office`, `on_the_way`, `canceled_returned`, or `delivered` status
- **THEN** the system requires the target rider to be active
- **AND** the system updates `parcels.rider_id`
- **AND** the system updates `assigned_at` when needed
- **AND** the system persists a rider correction log

#### Scenario: Delivered rider correction updates pending payout eligibility

- **WHEN** an authorized admin corrects the rider for a delivered parcel with an eligible pending `rider_way_payout` financial item
- **THEN** the system updates that pending financial item to the new rider
- **AND** the system persists all changes atomically

#### Scenario: Unassign rider is allowed only for safe statuses

- **WHEN** an authorized admin corrects rider assignment to unassigned
- **THEN** the system allows it only for statuses that can safely remain unassigned
- **AND** the system rejects unassigning statuses that require an active rider, including `on_the_way` and `delivered`

#### Scenario: Rider correction avoids merchant financial mutation

- **WHEN** an authorized admin corrects only the parcel rider
- **THEN** the system does not change merchant settlement totals or merchant settlement item amounts
- **AND** the system does not create or void merchant settlement financial items solely because the rider changed

### Requirement: Corrections are validated on the server

The system SHALL treat the server as the source of authority for every correction.

#### Scenario: Reason is required

- **WHEN** an admin submits a status or rider correction without a non-empty reason
- **THEN** the system rejects the request without changing parcel data

#### Scenario: Stale correction request is rejected

- **WHEN** a correction request is submitted after the parcel status, rider, or relevant financial item state has changed
- **THEN** the system rejects the request without changing parcel data
- **AND** the system returns an actionable stale-state error

#### Scenario: Correction is atomic

- **WHEN** any required parcel update, financial item update, status log write, or correction log write fails
- **THEN** the system does not persist a partial correction

