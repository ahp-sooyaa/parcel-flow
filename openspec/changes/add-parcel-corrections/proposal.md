## Why

Parcel status and rider assignment mistakes can happen after a parcel has already entered delivery, cash handover, merchant settlement, or rider payout workflows. Today admins can see status history through `parcel_status_logs`, but there is no explicit correction workflow that records why a correction happened and reconciles the operational and financial side effects. Manually changing only `parcels.status` or `parcels.rider_id` would leave derived fields and `financial_items` inconsistent.

## What Changes

- Add an admin-only parcel correction workflow from the parcel detail sheet.
- Show a `Corrections` section in the parcel detail sheet for super admins and office admins.
- Provide separate dialog flows for correcting parcel status and correcting assigned rider.
- Require a correction reason for every correction.
- Add a `parcel_correction_logs` table to record correction type, before/after values, actor, reason, and side-effect summary.
- Keep existing `parcel_status_logs` for status history and write to it when a status correction changes the parcel status.
- Apply status correction side effects transactionally, including parcel lifecycle timestamps, collection fields, office receipt state, failure note state, and eligible financial item cleanup.
- Apply rider correction side effects transactionally, including reassignment fields and pending rider payout financial item rider ownership where safe.
- Reject corrections that would mutate already settled merchant settlement or rider payout records until a dedicated settlement/payout reversal workflow exists.

## Capabilities

### New Capabilities

- `parcel-corrections`: Admin and superadmin parcel status/rider correction with audit logs and transactional side-effect reconciliation.

### Modified Capabilities

- `parcel-rider-assignment`: Rider correction becomes the explicit path for changing an already assigned parcel's rider after assignment.
- `rider-delivery-actions`: Delivered and returned parcel side effects must be reversible or blocked by the correction workflow according to financial item state.
- `admin-rider-cash-handover`: Delivered-to-undelivered corrections must clear office receipt state and void eligible pending COD remit items.
- `merchant-settlement-management`: Corrections must not silently alter items that are already reserved or settled in a merchant settlement.

## Impact

- Adds a Drizzle schema table, migration, relations, and database docs for `parcel_correction_logs`.
- Adds parcel feature server actions, DTO validation, DAL reconciliation helpers, and tests under `src/features/parcels`.
- Updates the admin parcel detail sheet UI to include correction controls and audit history.
- Updates parcel read DTOs to expose correction log history where the detail sheet needs it.
- Touches financial side-effect rules for pending `financial_items`, `merchant_settlement_status`, `rider_payout_status`, office cash receipt state, and rider assignment state.
- Requires integration tests for correction matrix cases so status/rider fixes do not leave stale derived records.
