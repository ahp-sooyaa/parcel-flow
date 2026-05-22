## 1. Documentation Alignment

- [x] 1.1 Update `docs/parcel-flow-project-spec.md` so the canceled-return workflow states that riders complete assigned return work by moving `canceled_returned -> returned_to_merchant`.
- [x] 1.2 Update the documented side effects for `returned_to_merchant` to reflect rider-owned completion and pending `delivery_fee_deduction` creation only after successful return.

## 2. Permission And Server Flow

- [x] 2.1 Extend parcel status permission rules so riders can perform `canceled_returned -> returned_to_merchant` for their own assigned parcels.
- [x] 2.2 Add a rider server action for return completion with role, ownership, and status validation plus dashboard path revalidation.
- [x] 2.3 Add DAL transaction logic that updates the parcel to `returned_to_merchant`, sets `returned_to_merchant_at`, preserves rider linkage, and writes the pending `delivery_fee_deduction` financial item atomically.
- [x] 2.4 Ensure the return-completion transaction rejects unrelated parcels, inactive riders, missing parcels, and parcels not currently in `canceled_returned`.

## 3. Rider Workflow UI

- [x] 3.1 Update the rider parcel card list so assigned `canceled_returned` parcels show a completion action for merchant return work.
- [x] 3.2 Wire the rider completion action to the new server action and refresh the rider parcel list on success.
- [x] 3.3 Ensure completed return parcels leave the rider `To Deliver` list and appear in a rider `Returned` tab once their status becomes `returned_to_merchant`.
- [x] 3.4 Keep the normal `Mark Delivered` and failure-report actions scoped to `on_the_way` parcels so return work does not reuse delivery-only affordances.

## 4. Verification

- [x] 4.1 Verify assigned `canceled_returned` parcels can be completed only by the owning active rider.
- [x] 4.2 Verify successful return completion creates exactly one pending `delivery_fee_deduction` financial item and no `cod_remit` or `rider_way_payout` item.
- [x] 4.3 Run lint after implementation.
- [x] 4.4 Run typecheck after implementation.
