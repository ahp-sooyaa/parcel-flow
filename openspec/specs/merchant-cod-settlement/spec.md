# merchant-cod-settlement Specification

## Purpose
TBD - created by archiving change add-merchant-cod-settlement-workflow. Update Purpose after archive.
## Requirements
### Requirement: Authorized staff can enter merchant settlement mode from COD in Held
The system SHALL provide a settlement mode on the merchant detail page that is triggered from the `COD in Held` stat card for authorized internal users. Settlement mode MUST list only parcels for the current merchant that are delivered, have COD status `collected`, have merchant settlement status `pending`, and are not linked to an active settlement.

#### Scenario: Authorized user starts settlement mode from COD in Held
- **WHEN** an authorized internal user activates the settle action from the `COD in Held` stat card on a merchant detail page
- **THEN** the system shows settlement mode for that merchant and filters the parcel table to eligible COD-held parcels only

#### Scenario: Ineligible parcels are excluded from settlement mode
- **WHEN** settlement mode loads for a merchant with parcels that are not delivered, do not have COD status `collected`, are not settlement `pending`, or are already linked to an active settlement
- **THEN** the system excludes those parcels from the available-to-settle list

#### Scenario: Unauthorized user cannot enter settlement mode
- **WHEN** a user without merchant settlement generation permission attempts to enter settlement mode
- **THEN** the system denies access to the settlement picker and does not return eligible parcel data

### Requirement: Settlement picker summarizes selected parcels before generation
The system SHALL display a checkbox column in settlement mode and SHALL show a floating settlement bar with the selected parcel count and selected COD amount total. The generate action MUST remain disabled until at least one eligible parcel is selected.

#### Scenario: Selected parcel summary updates
- **WHEN** an authorized user selects or clears eligible parcels in settlement mode
- **THEN** the settlement bar updates the selected parcel count and COD total using the selected rows

#### Scenario: Generate action disabled with no selection
- **WHEN** settlement mode is open and no parcel is selected
- **THEN** the system disables the generate settlement action

#### Scenario: Generate action enabled with selection
- **WHEN** settlement mode is open and at least one eligible parcel is selected
- **THEN** the system enables the generate settlement action

### Requirement: Settlement generation creates audit records and locks selected parcels
The system SHALL generate a `pending` merchant settlement from selected eligible parcels in one server-side transaction. The transaction MUST create the settlement record, snapshot the selected merchant bank details, create one settlement item per selected parcel payment record, snapshot item-level financial values, and lock the selected payment records against other active settlements.

#### Scenario: Generate settlement succeeds for eligible selection
- **WHEN** an authorized user submits selected eligible parcels and a valid merchant bank account for settlement generation
- **THEN** the system creates a pending settlement, creates settlement item snapshots for each selected parcel, records the creator, snapshots the bank name and account number, and removes those parcels from the available-to-settle pool

#### Scenario: Generation calculates net payable from snapshots
- **WHEN** a selected parcel has delivery fee status `deduct_from_settlement`
- **THEN** the settlement item stores the current COD amount, current delivery fee, `is_delivery_fee_deducted` as true, and net payable amount as COD amount minus delivery fee

#### Scenario: Generation keeps full COD payable when fee is not deducted
- **WHEN** a selected parcel does not have delivery fee status `deduct_from_settlement`
- **THEN** the settlement item stores `is_delivery_fee_deducted` as false and net payable amount equal to the COD amount

#### Scenario: Generation rejects stale or already locked selection
- **WHEN** a selected parcel no longer satisfies settlement eligibility at generation time
- **THEN** the system rejects settlement generation and does not create a partial settlement

### Requirement: Active settlements cannot overlap parcels
The system MUST prevent a parcel payment record from belonging to more than one active merchant settlement. Active settlements include generated settlements that are pending, in progress, or paid; cancelled and rejected settlements do not keep payment records locked.

#### Scenario: Concurrent generation attempts same parcel
- **WHEN** two authorized users attempt to generate active settlements containing the same eligible parcel
- **THEN** only one settlement can lock the parcel and the other generation attempt fails without creating an overlapping active settlement

#### Scenario: Locked parcel is unavailable to other settlement runs
- **WHEN** a parcel payment record is linked to a pending or in-progress settlement
- **THEN** the parcel does not appear in any available-to-settle list for any user

#### Scenario: Paid parcel remains unavailable
- **WHEN** a parcel payment record belongs to a paid settlement
- **THEN** the parcel remains unavailable for future settlement generation

### Requirement: Settlement history supports review and payment confirmation
The system SHALL show merchant settlement history to authorized users and SHALL allow authorized checker users to mark a pending or in-progress settlement as paid only after providing a payment slip image and reference number.

#### Scenario: Authorized user views settlement history
- **WHEN** an authorized user opens the settlement history for a merchant
- **THEN** the system lists settlement records for that merchant with status, total amount, item count, bank snapshot, creator, confirmer, and timestamps

#### Scenario: Checker confirms payment with proof
- **WHEN** an authorized checker uploads a valid payment slip image and enters a reference number for a pending or in-progress settlement
- **THEN** the system marks the settlement as paid, records the confirmer, stores the payment proof reference, and marks linked parcel payment records as settled

#### Scenario: Confirmation requires payment slip image
- **WHEN** an authorized checker attempts to mark a settlement paid without a payment slip image
- **THEN** the system rejects the confirmation and keeps the settlement unpaid

#### Scenario: Confirmation requires reference number
- **WHEN** an authorized checker attempts to mark a settlement paid without a reference number
- **THEN** the system rejects the confirmation and keeps the settlement unpaid

### Requirement: Pending settlements can be cancelled or rejected with parcel release
The system SHALL allow authorized users to cancel or reject a pending or in-progress settlement. Cancellation or rejection MUST release linked parcel payment records back to settlement `pending` and remove their active settlement lock while preserving the settlement record and item snapshots for audit.

#### Scenario: Authorized user cancels pending settlement
- **WHEN** an authorized user cancels a pending settlement
- **THEN** the system marks the settlement as cancelled, releases the linked payment records, and returns the parcels to the COD-in-held settlement pool

#### Scenario: Authorized user rejects in-progress settlement
- **WHEN** an authorized user rejects an in-progress settlement
- **THEN** the system marks the settlement as rejected, releases the linked payment records, and returns the parcels to the COD-in-held settlement pool

#### Scenario: Paid settlement cannot be cancelled or rejected
- **WHEN** a user attempts to cancel or reject a paid settlement
- **THEN** the system rejects the action and preserves the paid settlement and linked parcel payment states

### Requirement: Paid settlement totals are immutable
The system MUST preserve the financial total of a paid merchant settlement. Paid settlement item snapshots, total amount, bank snapshot, payment proof, reference number, creator, and confirmer fields MUST NOT be editable through parcel update or settlement update workflows.

#### Scenario: Paid settlement detail uses stored snapshots
- **WHEN** a user views a paid settlement after related parcel data has changed
- **THEN** the system displays settlement totals and item amounts from the stored settlement snapshots

#### Scenario: Paid settlement financial fields cannot be changed
- **WHEN** a user attempts to change a paid settlement total, item snapshot, or payment proof through a server action
- **THEN** the system rejects the change and preserves the original paid settlement record

