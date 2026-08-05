## Why

Rider payouts currently have a placeholder UI and validation-only action, while rider way credits are tied too narrowly to successful delivery. The business rule needs riders to be paid per actual delivery or merchant-return way, including failed delivery attempts that later become postponed and retried.

## What Changes

- Count one rider way when an assigned rider starts a receiver delivery attempt, including attempts that later fail and become `postpone`.
- Count another rider way when an assigned rider completes a `canceled_returned -> returned_to_merchant` return.
- Preserve way ownership by the rider assigned at the time of the qualifying attempt or return, even if the parcel is later reassigned.
- Allow multiple `rider_way_payout` financial items for the same parcel when there are multiple delivery attempts or return work events.
- Build rider payout management similar to merchant settlement: list riders with eligible pending way items, open a right-side sheet, select eligible items, create a payout draft, and resolve payout payment.
- Stop creating the delivery way payout only at successful `Mark Delivered`; the attempt credit must already exist before success, failure, postpone, or return decisions.
- Keep correction flows corrective: status correction does not create a missing delivery attempt, and rider correction may update only the latest eligible attempt credit whose ownership was recorded incorrectly.
- Keep merchant settlement items separate from rider payout items.

## Capabilities

### New Capabilities

- `rider-payout-management`: Admin rider payout eligibility, payout draft creation from pending way financial items, payout listing, and super admin payment resolution.

### Modified Capabilities

- `rider-parcel-card-workflow`: Rider start-delivery now creates one payable delivery attempt way for the currently assigned rider.
- `rider-delivery-actions`: Delivery success and failure flows must preserve the attempt way item instead of creating payout only on successful delivery.
- `admin-failure-parcel-management`: Postpone and return decisions after a failed attempt must preserve the failed rider's existing way credit while allowing later retry or return work to create separate credits.
- `canceled-parcel-return-completion`: Completing merchant return work must create one rider way payout item for the rider assigned to the return, in addition to merchant delivery-fee deduction behavior.
- `parcel-corrections`: Status and rider corrections must reconcile attempt and return way credits without moving historical credits to the wrong rider.

## Impact

- Affects rider parcel start-delivery, delivery success/failure, admin failure resolution, canceled-return completion, and parcel correction side effects under `src/features/parcels/server`.
- Replaces rider payout placeholder DAL/action behavior under `src/features/rider-payouts/server` with database-backed eligibility, draft creation, listing, and payment resolution.
- Updates `/dashboard/rider-payouts` from hard-coded data to a settlement-style payout workspace using shadcn right-side sheets.
- Uses existing `financial_items` and `rider_payouts` tables, with a small Drizzle migration for rider way source metadata so delivery-attempt and merchant-return way credits can be audited and corrected safely.
- Requires focused tests for repeated attempts, failed-postponed-retried parcels, return work by a different rider, stale item selection, and payout payment authorization.
