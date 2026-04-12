## 1. Parcel Feature Slice Foundation

- [x] 1.1 Create `src/features/parcels` structure with `components`, `server/actions.ts`, `server/dal.ts`, `server/dto.ts`, and `server/utils.ts`.
- [x] 1.2 Define parcel and payment zod input schemas in server layer with explicit allowlisted fields for create/update.
- [x] 1.3 Add shared parcel constants/utilities for enforced defaults and status enum guards (`pending`, `unpaid`, `cancelled`, etc.).

## 2. Read Paths for Admin Dashboard

- [x] 2.1 Implement parcel DAL read queries for admin list and detail views without exposing sensitive/unneeded fields.
- [x] 2.2 Implement parcel DTO shapers for list/detail payloads to keep UI contracts stable and safe.
- [x] 2.3 Wire dashboard parcel list/detail pages to the new parcel feature read paths for `superadmin`/`admin`.

## 3. Parcel Create Flow (Parcels + Payment Record)

- [x] 3.1 Implement parcel create server action with server-side authorization (`superadmin`/`admin` only) and zod validation.
- [x] 3.2 Implement transactional DAL create path that writes `parcels`, `parcel_payment_records`, and `parcel_audit_logs` atomically.
- [x] 3.3 Enforce creation defaults on server: parcel `pending`, delivery fee `unpaid`, COD/collection/merchant settlement/rider payout `pending`, delivery fee payer `receiver`.
- [x] 3.4 Build admin create UI (sectioned or multi-step) that captures required fields for both parcel and payment record tables.

## 4. Parcel Update and Cancellation Controls

- [x] 4.1 Implement parcel update server action with server-side authorization and zod validation for explicit updatable fields.
- [x] 4.2 Implement transactional DAL update path for parcel and payment status updates with corresponding parcel-linked audit log insert that records change source (`parcels` or `parcel_payment_records`).
- [x] 4.3 Enforce cancellation rule in server action: only `superadmin`/`admin` can set parcel status to `cancelled`.
- [x] 4.4 Build admin parcel update UI and ensure no delete/soft-delete workflow is introduced.

## 5. Auditability and Verification

- [x] 5.1 Ensure every successful create/update mutation writes immutable parcel audit log entries with actor, action, parcel reference, timestamp, and source context for `parcels` or `parcel_payment_records`.
- [x] 5.2 Add tests for authorization boundaries, default-status enforcement, transactional integrity, and cancelled-status restrictions.
- [x] 5.3 Add tests for form validation failures and allowlist behavior (reject/ignore unexpected fields).
- [x] 5.4 Run full parcel flow verification for admin dashboard scope and document rider-facing workflow as follow-up scope.
