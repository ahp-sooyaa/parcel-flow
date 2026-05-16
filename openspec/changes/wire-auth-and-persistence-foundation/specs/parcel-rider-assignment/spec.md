## ADDED Requirements

### Requirement: Persisted rider assignment
The system SHALL allow super admins and office admins to assign one or more parcels to a rider from the parcel list.

#### Scenario: Admin assigns selected parcels
- **WHEN** a super admin or office admin selects eligible parcels, selects a rider, and confirms assignment
- **THEN** the system stores the rider ID and assignment timestamp for each selected parcel

#### Scenario: Assignment preserves parcel status
- **WHEN** a parcel is assigned to a rider
- **THEN** the parcel keeps its current status

#### Scenario: Unauthorized assignment rejected
- **WHEN** a merchant or rider attempts to assign parcels
- **THEN** the system rejects the request before writing data

### Requirement: Assignment eligibility
The system SHALL validate selected parcels before rider assignment.

#### Scenario: Assign unassigned delivery-ready parcels
- **WHEN** selected parcels are unassigned and have status `at_office`
- **THEN** the system allows assignment to an active rider

#### Scenario: Assign unassigned postponed parcels
- **WHEN** selected parcels are unassigned and have status `postpone`
- **THEN** the system allows assignment to an active rider for retry or scheduled delivery

#### Scenario: Assign unassigned return-ready parcels
- **WHEN** selected parcels are unassigned and have status `canceled_returned`
- **THEN** the system allows assignment to an active rider for return handling

#### Scenario: Bulk assignment excludes assigned parcels
- **WHEN** a parcel is already assigned to a rider
- **THEN** the parcel is not selectable for bulk assignment and the bulk assignment action rejects it if submitted

#### Scenario: Reassignment handled outside bulk assignment
- **WHEN** an admin needs to change the rider for an already assigned parcel
- **THEN** the reassignment is handled from the edit parcel flow instead of the bulk assign rider action

#### Scenario: Assign ineligible status
- **WHEN** a selected parcel has a status other than `at_office`, `postpone`, or `canceled_returned`
- **THEN** the system rejects the assignment

### Requirement: Assignment summary uses persisted data
The system SHALL calculate rider assignment summary values from the selected persisted parcels and selected rider.

#### Scenario: Admin reviews assignment summary
- **WHEN** an admin selects parcels and a rider in the assignment dialog
- **THEN** the system displays selected parcel count, total COD amount, total delivery fee, total expected collection, rider current expected collection, and after-assignment expected collection

#### Scenario: Rider expected collection updates after assignment
- **WHEN** assignment succeeds
- **THEN** the selected rider's expected collection includes the assigned parcels that remain active for collection

### Requirement: Rider visibility after assignment
The system SHALL make assigned parcels visible to the assigned rider.

#### Scenario: Rider views assigned parcel
- **WHEN** a rider opens their parcel list after assignment
- **THEN** the newly assigned parcel appears in that rider's scoped parcel data

#### Scenario: Other riders cannot view assigned parcel
- **WHEN** another rider requests parcel data
- **THEN** the system does not return parcels assigned to a different rider

### Requirement: Assignment does not create financial side effects
The system SHALL NOT create financial items, settlement records, payout records, or delivery status changes during rider assignment.

#### Scenario: Assignment succeeds
- **WHEN** parcels are assigned to a rider
- **THEN** no financial items, merchant settlements, rider payouts, delivered timestamps, or collection confirmation fields are created or changed by the assignment operation
