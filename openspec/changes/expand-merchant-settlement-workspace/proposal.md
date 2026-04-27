## Why

The current merchant settlement mode is tightly bound to delivered COD remittance and calculates eligibility directly from parcel state at generation time. That is no longer enough for the planned workflow, where the same merchant settlement workspace must also handle merchant-billed delivery fees for returned or failed parcels, verified refunds for cancelled prepaid parcels, and optional netting of credits and debits into one document.

## What Changes

- Expand merchant settlement mode from a COD-only parcel picker into a merchant settlement workspace that lists all open settlement candidates for the selected merchant.
- Keep settlement entry anchored to merchant detail through one dominant `Open Settlement Workspace` action plus contextual shortcut buttons on summary cards that open the same workspace with preset filters.
- Introduce merchant financial item records that persist auditable credit and debit candidates derived from parcel and parcel payment state instead of relying only on on-the-fly settlement calculations.
- Allow settlement generation from selected merchant financial items and support remit, invoice, and netted document outcomes from the same settlement workspace.
- Show settlement workspace totals by credits, debits, and net amount so operators can decide whether to create a remit, invoice, or combined net settlement.
- Keep refund eligibility narrow by requiring verified merchant prepaid fee receipt before a cancelled parcel can create a refundable credit candidate.
- Preserve document locking, cancellation, rejection, payment confirmation, and immutable paid snapshots for mixed settlement documents, not only COD remittance parcels.

## Capabilities

### New Capabilities
- `merchant-financial-items`: Persist open merchant credit and debit items derived from parcel and payment truth for COD remittance, merchant billing, refunds, and future manual adjustments.

### Modified Capabilities
- `merchant-cod-settlement`: Broaden merchant settlement mode from COD-only parcel selection to a mixed candidate workspace that can generate remit, invoice, or netted settlement documents.
- `merchant-management`: Update merchant detail settlement entry points and stats behavior so authorized users can launch and understand the broader merchant settlement workspace from the merchant page.

## Impact

- Affected code:
  - `src/features/merchant-settlements`
  - `src/app/dashboard/merchants/[id]/page.tsx`
  - `src/features/parcels/server/dal.ts`
  - `src/features/parcels/server/utils.ts`
  - `src/db/schema.ts`
- Likely adds new finance tables and document/item relationships while preserving `parcels` and `parcel_payment_records` as operational truth.
- Requires new settlement candidate selection, locking, document direction, and payment confirmation rules.
- Requires merchant-detail button and filter preset behavior for `Process Settlement`, `Resolve Fees`, `Handle Returns`, and `Open Settlement Workspace`.
- Will supersede the current assumption that merchant settlement mode only handles delivered COD remittance.
