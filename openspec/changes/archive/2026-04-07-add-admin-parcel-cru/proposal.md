## Why

The operations team needs a reliable way to create, review, and correct parcel records from the admin dashboard while keeping accounting states explicit and auditable. Doing this now unblocks daily parcel intake and status management with clear defaults and strict role-based control.

## What Changes

- Add admin dashboard parcel create, read, and update flows for `superadmin` and `admin`.
- Capture parcel creation inputs from both `parcels` and `parcel_payment_records` in one guided form experience (sectioned or multi-step).
- Apply explicit default statuses on parcel creation:
- `parcel status`: `pending`
- `delivery fee status`: `unpaid`
- `cod status`: `pending`
- `collection status`: `pending`
- `merchant settlement status`: `pending`
- `rider payout status`: `pending`
- `delivery fee payer`: `receiver`
- Do not add soft-delete behavior for `parcels`, `parcel_payment_records`, or `parcel_audit_logs`.
- Allow only `superadmin` and `admin` to set parcel status to `cancelled`.
- Add parcel audit logging for creation and updates from both `parcels` and `parcel_payment_records`, while keeping audit records linked through the parcel relationship.
- Scope this change to admin-facing dashboard flows only; rider-facing status/payment updates are out of scope.

## Capabilities

### New Capabilities

- `admin-parcel-management`: Admin dashboard workflows to create, view, and update parcels with server-side authorization, validation, and status lifecycle control.
- `parcel-payment-recording`: Capture and update parcel-linked payment record data during parcel CRU with safe, explicit field handling.
- `parcel-audit-trail`: Record immutable parcel audit log entries for create and update actions coming from both parcel and parcel-payment updates, linked by parcel, to support operational/accounting traceability.

### Modified Capabilities

- None.

## Impact

- Affected areas: dashboard parcel pages/components, parcel feature server actions/DAL/DTO/utils, authorization checks, and validation schemas.
- Data scope: `parcels`, `parcel_payment_records`, and `parcel_audit_logs` usage and write paths.
- Security/operations impact: tighter role enforcement for cancellation and explicit default state handling for financial/operational status fields.
