## ADDED Requirements

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
