## Why

Parcel Flow needs a dedicated merchant management foundation so office/admin staff can quickly find and register merchants without relying on ad hoc records. This is needed now to support reliable daily operations and to establish secure, audit-friendly merchant data before merchant-linked parcel and settlement features are added.

## What Changes

- Add an internal merchant list workflow for authorized office/admin staff with fast browse and search by merchant identity fields.
- Add a merchant create workflow for authorized staff to register merchant profiles with explicit server-side validation and controlled field writes.
- Define merchant access boundaries: merchant-role users can access only their own merchant detail view (self-scope), and cannot access the full merchant list.
- Add merchant data model foundations to support future linkage with parcel and settlement/payment views.
- Support optional linkage between a merchant record and an admin-created app user account for future merchant login flows.

## Capabilities

### New Capabilities
- `merchant-management`: Internal merchant directory and onboarding capability covering merchant list, merchant create, permission-aware access rules, and future-ready merchant profile modeling.

### Modified Capabilities
- None.

## Impact

- Affected specs: new `merchant-management` capability spec.
- Affected app areas:
  - `src/features/merchant/*` for UI and server-side feature implementation.
  - authorization checks for list vs self-scope detail access paths.
  - merchant-related database schema and query paths for listing/search/create.
- Security/ops impact:
  - stronger internal data consistency for merchant onboarding.
  - explicit permission boundaries reduce accidental overexposure of merchant data.
