# parcel-audit-trail Specification

## Purpose
TBD - created by archiving change add-admin-parcel-cru. Update Purpose after archive.
## Requirements
### Requirement: Audit logging for parcel create and update
The system SHALL record an immutable audit log entry whenever an admin creates or updates a parcel through dashboard workflows.

#### Scenario: Create action audit entry
- **WHEN** an authorized admin successfully creates a parcel
- **THEN** the system writes a parcel audit log entry containing action type, actor identity, parcel reference, and timestamp

#### Scenario: Update action audit entry
- **WHEN** an authorized admin successfully updates parcel or parcel payment states
- **THEN** the system writes a parcel audit log entry containing action type, actor identity, parcel reference, and timestamp

### Requirement: Audit trail includes both parcel and parcel-payment sources
The system SHALL write parcel-linked audit log entries for changes originating from both `parcels` and `parcel_payment_records`.

#### Scenario: Parcel-table change source is recorded
- **WHEN** an authorized admin updates fields stored in `parcels`
- **THEN** the audit log entry is linked to the parcel and records `parcels` as the source context

#### Scenario: Payment-table change source is recorded
- **WHEN** an authorized admin updates fields stored in `parcel_payment_records`
- **THEN** the audit log entry is linked to the parcel and records `parcel_payment_records` as the source context

### Requirement: Cancellation changes are auditable
The system SHALL include parcel status transitions to `cancelled` in audit logs with actor and change context.

#### Scenario: Cancelled transition logged
- **WHEN** an authorized admin changes parcel status from non-cancelled to `cancelled`
- **THEN** the corresponding audit log entry captures the status change context and actor metadata

### Requirement: No soft delete in parcel audit storage
The system MUST NOT introduce soft-delete behavior for `parcel_audit_logs`.

#### Scenario: Audit log retention in normal operations
- **WHEN** parcel updates occur over time
- **THEN** prior audit log entries remain retained and queryable for traceability

