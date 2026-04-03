## ADDED Requirements

### Requirement: Authorized users can browse township records
The system SHALL provide a township list page inside the dashboard that reads from the township table and shows township fields needed for simple internal administration.

#### Scenario: User opens township list page
- **WHEN** an authenticated dashboard user opens `/dashboard/townships`
- **THEN** the system displays township rows from the township table

#### Scenario: Township list shows township table fields
- **WHEN** the township list page is rendered
- **THEN** the page shows the supported township fields stored in the township table for this phase

### Requirement: Authorized users can create township records
The system SHALL provide a township create page that accepts only township table fields and persists them through server-side validation.

#### Scenario: User creates township with valid fields
- **WHEN** an authenticated dashboard user submits valid township create data
- **THEN** the system creates a township record and persists only allowlisted township table fields

#### Scenario: Invalid township payload is rejected
- **WHEN** an authenticated dashboard user submits invalid township create data
- **THEN** the system rejects the request and does not create a township record

### Requirement: Township records support merchant and rider selection
The township table SHALL act as the source of truth for merchant and rider township selection in this change.

#### Scenario: Merchant form reads township options from table
- **WHEN** a user opens merchant-role creation fields
- **THEN** the township options are loaded from township records

#### Scenario: Rider form reads township options from table
- **WHEN** a user opens rider-role creation fields
- **THEN** the township options are loaded from township records
