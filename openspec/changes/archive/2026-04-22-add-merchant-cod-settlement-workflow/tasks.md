## 1. Schema and Authorization Foundations

- [x] 1.1 Add merchant settlement status, type, and permission constants needed by the workflow.
- [x] 1.2 Update `src/db/schema.ts` with `merchant_settlements`, `merchant_settlement_items`, settlement indexes, bank snapshot fields, maker/checker fields, payment proof fields, and an active settlement reference on `parcel_payment_records`.
- [x] 1.3 Generate the Drizzle migration from the updated schema and apply it through the project migration workflow.
- [x] 1.4 Update auth seed data and verification so super admins receive settlement permissions and merchant/rider roles do not.
- [x] 1.5 Add or update shared auth policy helpers for settlement view, create, confirm, and cancel/reject checks.

## 2. Settlement Server Feature

- [x] 2.1 Create `src/features/merchant-settlements` with `components`, `server/actions.ts`, `server/dal.ts`, `server/dto.ts`, and `server/utils.ts`.
- [x] 2.2 Add zod validation schemas for settlement generation, payment confirmation, payment slip upload metadata, cancellation, and rejection.
- [x] 2.3 Implement DAL queries for eligible settlement parcels, merchant settlement history, settlement detail, and selected payment-record revalidation.
- [x] 2.4 Implement server-side settlement amount helpers for COD snapshots, delivery fee deduction snapshots, net payable amount, and settlement totals.
- [x] 2.5 Implement the generation server action with transaction-based eligibility recheck, settlement creation, item snapshots, active payment-record lock updates, and creator audit data.
- [x] 2.6 Implement payment confirmation with required reference number, server-validated image upload, checker audit data, settlement `paid` status, and payment-record `settled` updates.
- [x] 2.7 Implement cancellation and rejection actions that release payment-record locks, return merchant settlement status to `pending`, and preserve settlement item snapshots.
- [x] 2.8 Shape safe settlement DTOs for list, detail, eligible parcel picker rows, and action responses without exposing unnecessary sensitive data.
- [x] 2.9 Write parcel audit or settlement audit entries for lock, paid, and release events.

## 3. Merchant Detail Integration

- [x] 3.1 Update merchant parcel stats so `COD in Held` uses delivered, COD-collected, settlement-pending, unlocked payment records.
- [x] 3.2 Add settlement entry controls to the `COD in Held` stat card for authorized internal users only.
- [x] 3.3 Add settlement mode to the merchant detail parcel table with eligible-only filtering and a checkbox selection column.
- [x] 3.4 Build the floating settlement bar with selected parcel count, selected COD total, and a disabled-until-selected generate action.
- [x] 3.5 Add settlement history UI scoped to the current merchant, including status, total amount, item count, bank snapshot, creator, confirmer, and timestamps.
- [x] 3.6 Add payment confirmation UI with payment slip image upload and reference number validation.
- [x] 3.7 Add cancel and reject controls for pending or in-progress settlements, hidden or disabled for paid settlements.

## 4. Parcel and Payment Workflow Guards

- [x] 4.1 Update parcel update policy and server action validation to block settlement-relevant financial edits for actively locked or paid settlement parcels.
- [x] 4.2 Prevent general parcel update workflows from manually setting settlement status to `settled` or clearing active settlement links.
- [x] 4.3 Ensure eligible parcel lists and merchant stats exclude locked and settled payment records consistently.
- [x] 4.4 Ensure paid settlement detail and history render from stored snapshots rather than current parcel financial values.
- [x] 4.5 Ensure settlement actions fail closed when merchant ownership, payment-record eligibility, permission state, or active account state is invalid.

## 5. Verification

- [x] 5.1 Run formatting for changed files.
- [x] 5.2 Run lint checks.
- [x] 5.3 Run TypeScript type checking.
- [x] 5.4 Run the application build check.
- [x] 5.5 Run Drizzle schema and migration validation after schema changes.
- [x] 5.6 Run OpenSpec status validation for this change.
