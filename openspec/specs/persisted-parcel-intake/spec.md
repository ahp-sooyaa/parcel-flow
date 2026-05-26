# persisted-parcel-intake Specification

## Purpose
TBD - created by archiving change wire-auth-and-persistence-foundation. Update Purpose after archive.
## Requirements
### Requirement: Persisted parcel list

The system SHALL load parcel lists from persisted database records and scope visibility by user role.

#### Scenario: Admin views parcels

- **WHEN** a super admin or office admin opens the parcels page
- **THEN** the system displays persisted parcels with merchant, rider, township, receiver, amount, status, and created date data

#### Scenario: Merchant views own parcels

- **WHEN** a merchant user requests parcel data
- **THEN** the system returns only parcels owned by that merchant profile

#### Scenario: Rider views assigned parcels

- **WHEN** a rider user requests parcel data
- **THEN** the system returns only parcels assigned to that rider profile

### Requirement: MVP parcel list controls

The system SHALL preserve the existing MVP parcel list search and filter controls when wiring persisted parcel data.

#### Scenario: Search persisted admin parcel list

- **WHEN** an admin searches the parcel list
- **THEN** the system filters persisted parcels by parcel code, receiver phone number, receiver name, or merchant name

#### Scenario: Filter persisted parcels by township

- **WHEN** an admin selects a township from the township combobox
- **THEN** the system filters persisted parcels to that delivery township

#### Scenario: Filter persisted parcels by parcel status

- **WHEN** an admin selects one or more parcel statuses
- **THEN** the system filters persisted parcels to parcels with matching statuses

#### Scenario: Filter persisted parcels by assignment tab

- **WHEN** an admin selects the `All`, `Unassigned`, or `Assigned` tab
- **THEN** the system filters persisted parcels by rider assignment state and updates the visible tab counts

#### Scenario: Unsupported admin list filters in Phase 1/2

- **WHEN** Phase 1/2 persistence wiring is implemented
- **THEN** merchant filter, rider filter, date-range filter, and pagination are not required unless the UI is expanded in a later change

### Requirement: Minimal merchant parcel page

The system SHALL provide a minimal role-specific parcel page for merchant users.

#### Scenario: Merchant opens landing page

- **WHEN** a merchant opens `/dashboard/merchant/parcels`
- **THEN** the system displays only that merchant's persisted parcels using merchant-scoped data access

#### Scenario: Merchant accesses admin parcel page

- **WHEN** a merchant attempts to access the superadmin-oriented parcel management page
- **THEN** the system redirects or denies access before showing admin-only controls

### Requirement: Minimal rider parcel page

The system SHALL provide a minimal role-specific parcel page for rider users.

#### Scenario: Rider opens landing page

- **WHEN** a rider opens `/dashboard/rider/parcels`
- **THEN** the system displays only parcels assigned to that rider using rider-scoped data access

#### Scenario: Rider accesses admin parcel page

- **WHEN** a rider attempts to access the superadmin-oriented parcel management page
- **THEN** the system redirects or denies access before showing admin-only controls

### Requirement: Persisted parcel creation

The system SHALL persist new parcels created by authorized admins.

#### Scenario: Admin creates COD parcel

- **WHEN** an authorized admin submits valid COD parcel details
- **THEN** the system creates a parcel with `parcel_type = cod`, the requested COD amount, stored delivery fee, `status = at_office`, `cod_status = pending`, `delivery_fee_status = pending`, `is_received_by_office = false`, and `created_by` set to the current user

#### Scenario: Admin creates non-COD parcel

- **WHEN** an authorized admin submits valid non-COD parcel details
- **THEN** the system creates a parcel with `parcel_type = non_cod`, `cod_amount = 0`, stored delivery fee, `status = at_office`, and `cod_status = not_applicable`

#### Scenario: Unauthorized parcel creation

- **WHEN** a merchant or rider submits a parcel creation request
- **THEN** the system rejects the request before writing data

### Requirement: Unique parcel code generation

The system SHALL generate readable unique parcel codes for persisted parcels.

#### Scenario: Generated code is unique

- **WHEN** a parcel is created
- **THEN** the system stores a code in `PF-XXXXXX-XXXXXX` format that is unique in the database

#### Scenario: Generated code collides

- **WHEN** a generated parcel code already exists
- **THEN** the system retries code generation up to the configured retry limit before returning a system error

### Requirement: Parcel creation validates referenced records

The system SHALL validate selected merchant and township records before parcel persistence.

#### Scenario: Missing merchant

- **WHEN** parcel creation references a missing or invalid merchant
- **THEN** the system rejects the request and does not create a parcel

#### Scenario: Inactive township

- **WHEN** parcel creation references an inactive township
- **THEN** the system rejects the request unless the acting user has an explicit allowed override

### Requirement: Parcel summary uses persisted data

The system SHALL calculate parcel dashboard summary values from persisted records.

#### Scenario: Admin sees summary cards

- **WHEN** an admin opens the parcel dashboard
- **THEN** total parcels, at-office count, on-the-way count, delivered count, and expected collection are calculated from database records visible to that admin

#### Scenario: Expected collection includes assigned at-office parcels

- **WHEN** expected collection is calculated
- **THEN** it includes active collection parcels with statuses `at_office` and `on_the_way` when a rider is assigned

