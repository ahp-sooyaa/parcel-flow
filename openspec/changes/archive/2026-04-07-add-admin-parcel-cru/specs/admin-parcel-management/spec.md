## ADDED Requirements

### Requirement: Admin parcel create access control
The system SHALL allow only `superadmin` and `admin` users to create parcels from the dashboard.

#### Scenario: Authorized parcel create
- **WHEN** an authenticated `superadmin` or `admin` submits a valid parcel create request
- **THEN** the system creates the parcel and returns a success response

#### Scenario: Unauthorized parcel create
- **WHEN** an authenticated non-admin user submits a parcel create request
- **THEN** the system rejects the request with an authorization error and no data is written

### Requirement: Parcel creation default lifecycle and payment status
The system SHALL enforce the following default values at parcel creation time, regardless of client-provided values: parcel status `pending`, delivery fee status `unpaid`, COD status `pending`, collection status `pending`, merchant settlement status `pending`, rider payout status `pending`, and delivery fee payer `receiver`.

#### Scenario: Defaults applied on parcel creation
- **WHEN** an authorized admin creates a parcel without optional status overrides
- **THEN** the created parcel and linked payment state persist with the required defaults

#### Scenario: Client attempts to override defaults on create
- **WHEN** an authorized admin submits create payload fields that conflict with required defaults
- **THEN** the server ignores those conflicting values and persists the required defaults

### Requirement: Admin parcel update access control
The system SHALL allow only `superadmin` and `admin` users to update parcel details from the dashboard.

#### Scenario: Authorized parcel update
- **WHEN** an authenticated `superadmin` or `admin` submits a valid parcel update request
- **THEN** the system updates the parcel and returns a success response

#### Scenario: Unauthorized parcel update
- **WHEN** an authenticated non-admin user submits a parcel update request
- **THEN** the system rejects the request with an authorization error and no data is changed

### Requirement: Cancellation status is admin-only and explicit
The system SHALL permit setting parcel status to `cancelled` only for `superadmin` and `admin` roles through server-validated update actions.

#### Scenario: Admin cancels parcel
- **WHEN** a `superadmin` or `admin` updates parcel status to `cancelled`
- **THEN** the system persists the cancelled status and records the action in audit logs

#### Scenario: Non-admin attempts cancellation
- **WHEN** a non-admin user attempts to set parcel status to `cancelled`
- **THEN** the system rejects the request and preserves the previous parcel status

### Requirement: No soft delete for admin parcel workflow
The system MUST NOT introduce soft-delete behavior for parcel records in this capability.

#### Scenario: Admin requests parcel removal
- **WHEN** an admin attempts to remove a parcel through the dashboard workflow
- **THEN** the system does not expose a soft-delete path and requires status-based lifecycle handling instead
