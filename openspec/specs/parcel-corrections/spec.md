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

The system SHALL apply status corrections transactionally and reconcile parcel fields and eligible financial side effects for the target status without moving historical rider way credits to the wrong rider.

#### Scenario: Delivered parcel is corrected away from delivered

- **WHEN** an authorized admin corrects a delivered parcel to a non-delivered status
- **THEN** the system clears delivered timestamp, collected timestamp, collected amount, office receipt confirmation, collection confirmer, and delivery proof references as required by the target state
- **AND** the system resets COD and delivery fee statuses according to the target state
- **AND** the system voids eligible pending `cod_remit` financial items for that parcel
- **AND** the system does not void historical `delivery_attempt` rider way payout items solely because the parcel is no longer delivered
- **AND** the system persists all changes atomically

#### Scenario: Returned parcel is corrected away from returned-to-merchant

- **WHEN** an authorized admin corrects a `returned_to_merchant` parcel to another status
- **THEN** the system clears `returned_to_merchant_at`
- **AND** the system resets delivery fee status according to the target state
- **AND** the system voids eligible pending `delivery_fee_deduction` financial items for that parcel
- **AND** the system voids eligible pending `merchant_return` rider way payout items associated with the corrected return completion
- **AND** the system preserves existing `delivery_attempt` rider way payout items for prior delivery attempts
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to delivered

- **WHEN** an authorized admin corrects a parcel to `delivered`
- **THEN** the system requires the parcel to have an active assigned rider
- **AND** the system requires an existing active `delivery_attempt` rider way payout item for the actual delivery attempt
- **AND** the system sets delivered timestamp, collected timestamp, collected amount, COD status, delivery fee status, office receipt state, settlement status, and payout status consistently
- **AND** the system preserves the latest delivery-attempt item when its rider already matches the corrected rider
- **AND** when the corrected rider differs, the system reassigns only the latest eligible pending delivery-attempt item to that rider
- **AND** the system rejects the rider ownership change when that latest item is reserved or settled
- **AND** the system does not create a new delivery-attempt item solely because the status was corrected
- **AND** the system persists all changes atomically

#### Scenario: Delivered correction cannot replace normal delivery workflow

- **WHEN** an authorized admin attempts to correct a parcel to `delivered` without an existing active delivery-attempt item
- **THEN** the system rejects the correction
- **AND** the system requires the parcel to follow the normal `at_office` to `on_the_way` start-delivery workflow before delivery completion

#### Scenario: Parcel is corrected to returned-to-merchant

- **WHEN** an authorized admin corrects a parcel to `returned_to_merchant`
- **THEN** the system sets `returned_to_merchant_at`
- **AND** the system sets delivery fee status to `deduct_from_merchant`
- **AND** the system creates one eligible pending `delivery_fee_deduction` financial item if no active deduction item exists
- **AND** the system creates one eligible pending `merchant_return` rider way payout item for the target rider when the correction represents completed rider return work
- **AND** the system creates no merchant-return rider way payout item when no rider is attributed to the manual return correction
- **AND** the system does not duplicate active merchant-return rider way payout items for the same corrected return event
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to at-office

- **WHEN** an authorized admin corrects a parcel to `at_office`
- **THEN** the system clears delivery, return, collection, office receipt, collection confirmer, and proof fields
- **AND** the system clears the current rider assignment by default
- **AND** the system resets COD and delivery fee statuses according to parcel type
- **AND** the system voids eligible pending financial items that belong to later lifecycle states
- **AND** the system preserves historical rider way payout items for completed delivery-attempt work unless the correction explicitly reverses that attempt event
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
- **AND** the system preserves historical `delivery_attempt` rider way payout items for completed delivery attempts
- **AND** the system does not create new financial items
- **AND** the system persists all changes atomically

#### Scenario: Parcel is corrected to canceled-returned

- **WHEN** an authorized admin corrects a parcel to `canceled_returned`
- **THEN** the system clears active delivery, delivery completion, return completion, collection, office receipt, collection confirmer, and proof fields
- **AND** the system clears rider assignment unless the admin explicitly keeps or selects an active rider for return handling
- **AND** the system deactivates any active failure note that the correction resolves
- **AND** the system voids eligible pending financial items that are inconsistent with the canceled-returned state
- **AND** the system preserves historical `delivery_attempt` rider way payout items for completed delivery attempts
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

The system SHALL allow admins to correct the assigned rider when the target state can remain consistent while preserving historical rider way ownership.

#### Scenario: Active delivery rider is corrected

- **WHEN** an authorized admin corrects the rider for a parcel in `at_office`, `on_the_way`, `canceled_returned`, or `delivered` status
- **THEN** the system requires the target rider to be active
- **AND** the system updates `parcels.rider_id`
- **AND** the system updates `assigned_at` when needed
- **AND** the system persists a rider correction log

#### Scenario: Current delivery attempt rider correction updates pending attempt credit

- **WHEN** an authorized admin corrects the rider for an `on_the_way` or `delivered` parcel with an eligible pending latest `delivery_attempt` rider way payout item that is not linked to a payout
- **THEN** the system updates that current attempt financial item to the corrected rider
- **AND** the system preserves earlier delivery-attempt and merchant-return items
- **AND** the system persists all changes atomically

#### Scenario: Historical rider way ownership is preserved

- **WHEN** an authorized admin corrects the current rider for a parcel with existing rider way payout items from prior delivery-attempt or merchant-return events
- **THEN** the system does not move those historical rider way payout items to the new current rider solely because the current parcel assignment changed
- **AND** any rider way payout item linked to an in-progress or settled payout continues to block unsafe mutation

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
