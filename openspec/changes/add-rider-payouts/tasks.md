## 1. Data Model and Shared Rules

- [x] 1.1 Add rider way source metadata to `financial_items` in `src/db/schema.ts` and generate a Drizzle migration that preserves existing rider way rows as legacy delivery credits.
- [x] 1.2 Add shared rider way source constants, financial item type guards, and payout status aggregation helpers in the existing feature/server utility locations.
- [x] 1.3 Update project docs and the database diagram for the rider way source metadata and the new failed-attempt and merchant-return payout rules.

## 2. Parcel Lifecycle Side Effects

- [x] 2.1 Update rider start-delivery DAL logic to lock eligible assigned `at_office` parcels, move them to `on_the_way`, and create one pending `delivery_attempt` rider way item per parcel atomically.
- [x] 2.2 Update rider mark-delivered logic so it persists delivery state without creating duplicate rider way items or COD remit items.
- [x] 2.3 Update rider failure reporting and admin failure resolution paths to preserve existing delivery-attempt rider way items while clearing expected collection on `postpone` or `canceled_returned`.
- [x] 2.4 Update canceled-return completion to create both the merchant `delivery_fee_deduction` item and a pending `merchant_return` rider way item for the assigned return rider.
- [x] 2.5 Update parcel correction logic to use rider way source metadata when preserving, voiding, or reassigning pending rider way items.
- [x] 2.6 Recompute affected parcel `rider_payout_status` summaries from active rider way financial items after parcel lifecycle and correction side effects.

## 3. Rider Payout Server Feature

- [x] 3.1 Replace hard-coded rider payout DAL data with database-backed payout listing DTOs.
- [x] 3.2 Add DAL queries for eligible payout riders and selectable pending rider way financial items.
- [x] 3.3 Implement rider payout draft creation with stale item validation, payout code generation, item reservation, totals, and parcel payout status recomputation in one transaction.
- [x] 3.4 Implement rider payout settlement with super-admin permission checks, linked item settlement, paid metadata, and parcel payout status recomputation.
- [x] 3.5 Implement rider payout draft cancellation with item release, payout voiding, and parcel payout status recomputation.
- [x] 3.6 Update rider payout server actions and Zod schemas for create, settle, and cancel flows with field-level validation where practical.

## 4. Rider Payout UI

- [x] 4.1 Replace `/dashboard/rider-payouts` placeholder content with persisted payout table data and empty states.
- [x] 4.2 Build the shadcn right-side sheet create flow with rider selection, eligible item selection, fee-per-way input, way count, and payout total summary.
- [x] 4.3 Add payout row actions for authorized cancellation and super-admin payment settlement.
- [x] 4.4 Keep UI controls role-aware while relying on server actions for final authorization.

## 5. Tests and Verification

- [x] 5.1 Add parcel lifecycle tests for delivery-attempt way creation, failed attempt preservation, postponed retry way creation, and merchant return way creation by a different rider.
- [x] 5.2 Add parcel correction tests for preserving historical delivery-attempt credits and voiding only source-appropriate pending return credits.
- [x] 5.3 Add rider payout DAL/action tests for eligibility, draft creation, stale selection rejection, cancellation, settlement, and permission failures.
- [x] 5.4 Add component tests for the rider payout table and create sheet selection/summary behavior.
- [x] 5.5 Run `bun run typecheck`, `bun run lint`, `bun run test:unit`, and `bun run test:integration` when feasible.

## 6. Verification Corrections

- [x] 6.1 Clarify that status correction cannot create a delivery attempt and that only the latest eligible attempt ownership may be corrected.
- [x] 6.2 Fix delivered and returned correction reconciliation, legacy source matching, and eligible-item payout status display.
- [x] 6.3 Add focused regression coverage and rerun OpenSpec validation, typecheck, lint, unit/component tests, and integration tests.
