## Why

Assigned `canceled_returned` parcels already appear in the rider `To Deliver` list, but the current rules still treat `returned_to_merchant` as an admin-only status change. That leaves riders with visible return work they cannot complete and creates a mismatch between the rider UI, the parcel workflow, and the settlement rule for return delivery fees.

## What Changes

- Allow an active rider to complete an assigned `canceled_returned` parcel as returned to merchant from the rider parcel workflow.
- Add rider-facing return-completion behavior so assigned return-work parcels show the correct completion action instead of only the normal delivery action model.
- Change the return-completion transition so successful rider completion updates parcel status from `canceled_returned` to `returned_to_merchant`.
- Add a rider `Returned` tab so completed `returned_to_merchant` parcels remain visible after leaving `To Deliver`.
- Create the merchant settlement `delivery_fee_deduction` financial item only when the return is successfully completed.
- Keep the existing rule that no delivery-fee deduction is created when admin first marks the failed parcel as `canceled_returned`.
- Align the main parcel-flow documentation with the intended canceled-return flow so permissions, side effects, and rider workflow all describe the same behavior.

## Capabilities

### New Capabilities
- `canceled-parcel-return-completion`: Rider-completed return-to-merchant workflow, status transition, and financial-item side effects for assigned `canceled_returned` parcels.

### Modified Capabilities

## Impact

- Affects rider parcel workflow UI under `src/features/parcels/components`.
- Affects parcel rider actions, permission checks, and DAL transaction logic under `src/features/parcels/server`.
- Affects parcel status side effects and `financial_items` creation for returned parcels.
- Requires updates to `docs/parcel-flow-project-spec.md` so the documented canceled-return flow matches the intended product behavior.
- No new dependency, service, or architectural layer is required.
