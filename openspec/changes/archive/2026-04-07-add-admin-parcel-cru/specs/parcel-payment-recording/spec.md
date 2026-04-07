## ADDED Requirements

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
