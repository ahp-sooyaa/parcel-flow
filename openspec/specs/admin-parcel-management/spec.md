# admin-parcel-management Specification

## Purpose
TBD - created by archiving change add-admin-parcel-cru. Update Purpose after archive.
## Requirements
### Requirement: Admin parcel create access control
The system SHALL allow `superadmin` and `admin` users to create parcels from the dashboard for any permitted merchant. The system SHALL also allow authenticated merchant users to create parcels through the shared parcel create workflow only for the merchant profile linked to their own account. The server MUST reject any create attempt from other roles or any merchant-scoped create request that targets a different merchant.

#### Scenario: Admin creates parcel successfully
- **WHEN** an authenticated `superadmin` or `admin` submits a valid parcel create request
- **THEN** the system creates the parcel and returns a success response

#### Scenario: Merchant user creates parcel for owned merchant
- **WHEN** an authenticated merchant user submits a valid parcel create request for the merchant profile linked to their account
- **THEN** the system creates the parcel and returns a success response

#### Scenario: Merchant create shows merchant as read-only and server-owned
- **WHEN** an authenticated merchant user opens the shared parcel create page
- **THEN** the merchant field is rendered read-only for clarity and the server persists the parcel only for the merchant linked to the current session

#### Scenario: Merchant user attempts create for another merchant
- **WHEN** an authenticated merchant user submits a parcel create request using a different merchant identifier than their linked merchant record
- **THEN** the system rejects the request with an authorization error and no data is written

#### Scenario: Unauthorized non-merchant non-admin user cannot create parcel
- **WHEN** an authenticated user who is neither admin nor merchant owner submits a parcel create request
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
The system SHALL allow `superadmin` and `admin` users to update parcel details from the dashboard. The system SHALL also allow authenticated merchant users to update parcels through the shared parcel edit workflow only when the parcel belongs to the merchant profile linked to their own account. Rider users and other non-admin roles MUST NOT receive parcel edit access.

#### Scenario: Admin updates parcel successfully
- **WHEN** an authenticated `superadmin` or `admin` submits a valid parcel update request
- **THEN** the system updates the parcel and returns a success response

#### Scenario: Merchant user updates owned parcel
- **WHEN** an authenticated merchant user submits a valid parcel update request for a parcel linked to their own merchant record
- **THEN** the system updates the parcel and returns a success response

#### Scenario: Merchant user attempts to update another merchant parcel
- **WHEN** an authenticated merchant user submits a parcel update request for a parcel linked to a different merchant
- **THEN** the system rejects the request with an authorization error and no data is changed

#### Scenario: Rider user cannot access parcel edit
- **WHEN** an authenticated rider user submits or opens a parcel edit request
- **THEN** the system denies access and preserves the current parcel state

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

