# parcel-payment-recording Specification

## Purpose
TBD - created by archiving change add-admin-parcel-cru. Update Purpose after archive.
## Requirements
### Requirement: Combined parcel and payment input workflow
The system SHALL provide a single admin parcel create workflow that captures required fields from `parcels` and `parcel_payment_records` in one guided experience (sectioned or multi-step).

#### Scenario: Complete create submission across sections
- **WHEN** an authorized admin completes all required parcel and payment sections and submits
- **THEN** the system validates and persists both parcel and payment record data in one successful operation

#### Scenario: Incomplete payment section
- **WHEN** an authorized admin submits parcel create without required payment record inputs
- **THEN** the system rejects the submission with validation errors mapped to missing payment fields

### Requirement: Server-side validation for payment fields
The system SHALL validate parcel payment record fields on the server using explicit schemas and MUST write only allowlisted fields.

#### Scenario: Invalid payment field value
- **WHEN** an authorized admin submits a payment field with invalid type or enum value
- **THEN** the system rejects the request and returns a validation error without writing data

#### Scenario: Extra payment fields provided
- **WHEN** an authorized admin submits unrecognized payment fields
- **THEN** the system ignores or rejects non-allowlisted fields and writes only approved fields

### Requirement: Payment status defaults at creation
The system SHALL initialize delivery-fee, COD, collection, merchant-settlement, and rider-payout statuses using the required default states at creation time.

#### Scenario: Payment defaults persisted on create
- **WHEN** an authorized admin creates a new parcel with valid base inputs
- **THEN** the linked payment record is created with delivery fee status `unpaid` and the remaining payment statuses set to `pending`

### Requirement: Delivery fee payer default
The system SHALL set delivery fee payer to `receiver` when a parcel is created.

#### Scenario: Default fee payer applied
- **WHEN** an authorized admin creates a parcel without specifying fee payer
- **THEN** the system stores delivery fee payer as `receiver`

### Requirement: Merchant settlement lifecycle controls payment record settlement state
The system SHALL manage parcel payment record merchant settlement state through merchant settlement workflows. A payment record starts eligible with merchant settlement status `pending` and no active settlement link, moves to `in_progress` when included in a generated settlement, moves to `settled` when that settlement is paid, and returns to `pending` when a pending or in-progress settlement is cancelled or rejected.

#### Scenario: Payment record becomes locked after settlement generation
- **WHEN** an eligible parcel payment record is included in a generated merchant settlement
- **THEN** the payment record stores the active settlement link and merchant settlement status `in_progress`

#### Scenario: Payment record becomes settled after payment confirmation
- **WHEN** the linked merchant settlement is marked paid
- **THEN** the payment record keeps the settlement link and merchant settlement status becomes `settled`

#### Scenario: Payment record returns to pending after cancellation
- **WHEN** the linked merchant settlement is cancelled or rejected before payment
- **THEN** the payment record clears the active settlement link and merchant settlement status returns to `pending`

### Requirement: COD in held is derived from eligible payment records
The system SHALL calculate COD-in-held settlement eligibility from server-side parcel and payment record state. A parcel contributes to COD in held only when it belongs to the merchant, is delivered, is COD, has COD status `collected`, has merchant settlement status `pending`, and is not locked by an active settlement.

#### Scenario: Eligible delivered COD contributes to held total
- **WHEN** a merchant has a delivered COD parcel with COD status `collected`, merchant settlement status `pending`, and no active settlement link
- **THEN** the parcel contributes its COD amount to COD in held

#### Scenario: Locked payment record does not contribute to held total
- **WHEN** a parcel payment record is linked to an active settlement
- **THEN** the parcel does not contribute to COD in held even if its COD status is `collected`

#### Scenario: Settled payment record does not contribute to held total
- **WHEN** a parcel payment record has merchant settlement status `settled`
- **THEN** the parcel does not contribute to COD in held

### Requirement: Settlement status changes are auditable
The system SHALL record settlement-driven payment record changes in the parcel audit trail or settlement audit data so operators can trace when a parcel was locked, settled, or released.

#### Scenario: Settlement generation records lock event
- **WHEN** a settlement generation locks parcel payment records
- **THEN** the system records an auditable event identifying the settlement and actor

#### Scenario: Settlement cancellation records release event
- **WHEN** a settlement cancellation or rejection releases parcel payment records
- **THEN** the system records an auditable event identifying the settlement and actor

#### Scenario: Settlement payment records settled event
- **WHEN** a settlement is marked paid
- **THEN** the system records an auditable event identifying the settlement, actor, and settled payment records

