# persisted-township-settings Specification

## Purpose
TBD - created by archiving change wire-auth-and-persistence-foundation. Update Purpose after archive.
## Requirements
### Requirement: Persisted township list

The system SHALL load township delivery pricing/settings from the database instead of mock arrays.

#### Scenario: Admin views township settings

- **WHEN** an authorized admin opens the township or settings page
- **THEN** the system displays persisted township records with base fee, base weight, extra weight fee, extra weight unit, volumetric divisor, COD fee percent, return fee percent, and active status

#### Scenario: Parcel form loads active townships

- **WHEN** an admin opens the parcel creation form
- **THEN** the township selector is populated from active persisted township records

### Requirement: Persisted township creation

The system SHALL allow authorized users to create township pricing records.

#### Scenario: Super admin creates township

- **WHEN** a super admin submits valid township pricing details
- **THEN** the system stores a new township record and makes it available to parcel creation

#### Scenario: Unauthorized township creation

- **WHEN** a user without township pricing permission submits a township creation request
- **THEN** the system rejects the request before writing data

### Requirement: Persisted township update

The system SHALL allow authorized users to update township pricing records.

#### Scenario: Super admin updates pricing

- **WHEN** a super admin submits valid changes to an existing township
- **THEN** the system persists the new pricing and active status

#### Scenario: Existing parcels retain stored delivery fee

- **WHEN** township pricing changes after parcels already exist
- **THEN** existing parcels keep their stored `delivery_fee` value unless explicitly edited by an allowed user

### Requirement: Township values are validated

The system SHALL validate township pricing inputs before persistence.

#### Scenario: Invalid pricing rejected

- **WHEN** a township request contains invalid negative fees, invalid weights, invalid percentages, or missing names
- **THEN** the system returns a validation error and does not write data

