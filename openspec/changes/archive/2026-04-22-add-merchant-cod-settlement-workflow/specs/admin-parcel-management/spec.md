## ADDED Requirements

### Requirement: Parcel financial edits respect merchant settlement locks
The system SHALL reject parcel update attempts that would change settlement-relevant financial values while the parcel payment record is linked to an active merchant settlement. Settlement-relevant values include COD amount, delivery fee, delivery fee deduction state, COD status, merchant settlement status, merchant ownership, and parcel delivered state when those fields determine eligibility or settlement totals.

#### Scenario: Active settlement blocks total-changing parcel update
- **WHEN** an authorized user attempts to update COD amount, delivery fee, or delivery fee deduction state for a parcel linked to a pending or in-progress merchant settlement
- **THEN** the system rejects the update and preserves the current parcel and payment record financial values

#### Scenario: Paid settlement blocks financial parcel update
- **WHEN** an authorized user attempts to update settlement-relevant financial fields for a parcel linked to a paid merchant settlement
- **THEN** the system rejects the update and preserves the paid settlement total

#### Scenario: Non-financial parcel update remains allowed when policy permits
- **WHEN** an authorized user updates a non-financial parcel field that does not change settlement eligibility or paid settlement totals
- **THEN** the system allows the update according to the existing parcel update authorization policy

### Requirement: Parcel updates cannot manually bypass settlement lifecycle
The system SHALL prevent general parcel update workflows from directly setting merchant settlement state in a way that bypasses settlement generation, confirmation, cancellation, or rejection actions.

#### Scenario: User attempts manual settlement status change
- **WHEN** a parcel update request attempts to manually set merchant settlement status from `pending` to `settled`
- **THEN** the system rejects the change unless it is performed by the authorized settlement confirmation workflow

#### Scenario: User attempts manual settlement lock removal
- **WHEN** a parcel update request attempts to clear an active settlement link
- **THEN** the system rejects the change unless it is performed by the authorized settlement cancellation or rejection workflow
