## Why

Merchant COD funds can currently be viewed as held amounts, but there is no auditable workflow for selecting delivered COD parcels, locking them against duplicate settlement, confirming external payment, and releasing them when a pending settlement is wrong. This change is needed before COD remittance can be handled reliably by multiple admins or finance operators.

## What Changes

- Add a merchant COD settlement workflow initiated from the `COD in Held` stat on the merchant detail page.
- Add a settlement mode on merchant detail that filters the parcel list to delivered parcels with collected COD and pending merchant settlement status.
- Add checkbox selection and a bottom settlement bar that summarizes selected parcel count and COD amount before generation.
- Create `merchant_settlement` and `merchant_settlement_item` records in a transaction, snapshotting COD amount, delivery fee, fee deduction state, and net payable amount for each selected parcel.
- Lock selected parcel payment records by linking them to the generated settlement and moving them out of the available-to-settle pool.
- Add settlement history and fulfillment actions for reviewing pending settlements, uploading a payment slip image, entering a reference number, and marking the settlement as paid.
- Add cancellation/rejection for pending settlements that releases linked parcels back to the COD-in-held pool.
- Add maker/checker audit fields so settlement creation and payment confirmation record different actor responsibilities.
- Enforce no-overlap rules for active settlements and preserve paid settlement totals against later parcel edits.
- Add permission-gated server actions and DTOs for settlement list, generation, confirmation, and cancellation/rejection.

## Capabilities

### New Capabilities
- `merchant-cod-settlement`: End-to-end merchant COD settlement workflow covering eligible parcel picking, settlement generation, parcel locking, payment confirmation, paid-state immutability, and pending-state reversal.

### Modified Capabilities
- `merchant-management`: Merchant detail gains settlement mode from the `COD in Held` stat card plus a settlement history tab for authorized internal users.
- `parcel-payment-recording`: Merchant settlement status becomes lifecycle-managed by settlement records, including pending eligibility, active lock state, settled state, and release after cancellation/rejection.
- `admin-parcel-management`: Parcel update behavior must reject changes that would alter paid settlement totals or modify fields locked by an active settlement.
- `authorization-foundation`: The baseline permission model gains explicit merchant settlement permissions for viewing, generating, confirming, and cancelling/rejecting settlements without introducing a new application role.

## Impact

- Affected routes: `src/app/dashboard/merchants/[id]/page.tsx` and any new merchant settlement detail or action routes needed under the existing dashboard app.
- Affected feature slices: `src/features/merchant/*`, `src/features/parcels/*`, and new `src/features/merchant-settlements/*`.
- Database impact: Drizzle schema changes for settlement and settlement item tables, plus a generated migration.
- Storage impact: payment slip image upload handling must validate type and size on the server before persisting object keys or URLs.
- Authorization impact: new permission constants, seed expectations, policy helpers, route gating, and server action checks.
- Accounting impact: settlement totals must be calculated from server-side parcel payment data and stored snapshots, with COD treated as merchant funds rather than company revenue.
