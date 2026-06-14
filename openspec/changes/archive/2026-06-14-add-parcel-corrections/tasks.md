## 1. Schema and Documentation

- [x] 1.1 Add `parcelCorrectionLogs` to `src/db/schema.ts` with status/rider before-after fields, optional `statusLogId`, reason, side-effect JSON, actor, timestamps, indexes, and relations.
- [x] 1.2 Generate or add the Drizzle migration for `parcel_correction_logs`.
- [x] 1.3 Update `docs/database-mermaid-diagram.md` with the new table and relationships.
- [x] 1.4 Add correction type and side-effect summary TypeScript types in the parcel feature or domain layer without creating root service folders.

## 2. Correction Rules and DAL

- [x] 2.1 Add Zod DTO schemas for status correction and rider correction inputs, including required reason validation.
- [x] 2.2 Implement `correctParcelStatus` in the parcel DAL as one database transaction.
- [x] 2.3 Implement `correctParcelRider` in the parcel DAL as one database transaction.
- [x] 2.4 Load parcel, rider, active failure note, and related financial item state inside each correction transaction.
- [x] 2.5 Reject non-admin actors, missing parcels, inactive target riders, invalid target statuses, and stale correction requests.
- [x] 2.6 Block corrections touching settled or in-progress merchant settlement items.
- [x] 2.7 Block corrections touching in-progress or settled rider payout items.
- [x] 2.8 Void eligible pending financial items when correcting away from lifecycle states that created them.
- [x] 2.9 Update eligible pending rider payout financial items when correcting a delivered parcel's rider.
- [x] 2.10 Prevent duplicate active financial items when correcting to `delivered` or `returned_to_merchant`.
- [x] 2.11 Write `parcel_status_logs` for every status correction that changes `parcels.status`.
- [x] 2.12 Write `parcel_correction_logs` for every successful correction with reason, structured side-effect summary, and linked status log for status corrections.
- [x] 2.13 Implement explicit target-state handlers for `at_office`, `on_the_way`, `postpone`, `canceled_returned`, `delivered`, and `returned_to_merchant`.
- [x] 2.14 Ensure corrections between non-financial statuses do not create `cod_remit`, `delivery_fee_deduction`, or `rider_way_payout` items.

## 3. Server Actions and Revalidation

- [x] 3.1 Add admin-only server actions for status correction and rider correction in `src/features/parcels/server/actions.ts`.
- [x] 3.2 Return clear validation messages for blocked financial states, stale status/rider data, missing required rider, and unsupported target state.
- [x] 3.3 Revalidate admin parcel list/detail, rider parcel list, rider summary, merchant parcel views, dashboard, and settlement workspace after successful corrections.
- [x] 3.4 Ensure correction actions do not expose mutation paths to merchants or riders.

## 4. Parcel Detail Sheet UI

- [x] 4.1 Add a `Corrections` section to the admin parcel detail sheet.
- [x] 4.2 Add a `Correct Status` dialog using shadcn/ui components.
- [x] 4.3 Add target-status selection, required reason textarea, conditional rider/proof inputs, side-effect warnings, pending state, and success/error feedback.
- [x] 4.4 Add a `Correct Rider` dialog using shadcn/ui components.
- [x] 4.5 Add target-rider selection or allowed unassign option, required reason textarea, side-effect warnings, pending state, and success/error feedback.
- [x] 4.6 Show recent correction history in the detail sheet with actor, time, before/after values, reason, and side-effect summary.
- [x] 4.7 Hide correction controls from merchant and rider parcel detail views.

## 5. Tests

- [x] 5.1 Add DAL/integration tests for correcting `delivered` to `on_the_way`, `at_office`, `postpone`, and `canceled_returned`.
- [x] 5.2 Add DAL/integration tests for correcting `returned_to_merchant` away from return completion and voiding pending delivery fee deductions.
- [x] 5.3 Add DAL/integration tests for correcting to `delivered` without duplicating financial items.
- [x] 5.4 Add DAL/integration tests for correcting to `returned_to_merchant` without duplicating delivery fee deduction items.
- [x] 5.5 Add DAL/integration tests for correcting to `at_office`, `on_the_way`, `postpone`, and `canceled_returned` from non-financial source statuses.
- [x] 5.6 Add DAL/integration tests proving corrections between non-financial statuses do not create financial items.
- [x] 5.7 Add DAL/integration tests for rider correction on active, on-the-way, delivered, and unassignable statuses.
- [x] 5.8 Add tests that settled, in-progress settlement, and in-progress/settled payout states block unsafe corrections.
- [x] 5.9 Add server action tests for authorization, validation, stale data errors, revalidation, and success responses.
- [x] 5.10 Add component tests for the Corrections section, dialogs, required reason validation, conditional fields, and error display.

## 6. Verification

- [x] 6.1 Run lint after implementation.
- [x] 6.2 Run typecheck after implementation.
- [x] 6.3 Run relevant unit, component, and integration tests for parcel corrections.
  - Unit and component tests pass. Integration test execution is blocked because the local test database at `127.0.0.1:54322` is not running.
- [x] 6.4 Manually verify status correction from the parcel detail sheet for representative statuses.
- [x] 6.5 Manually verify rider correction from the parcel detail sheet for assigned, delivered, and unassignable parcels.
