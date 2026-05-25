## Why

The app already creates `financial_items` for delivered COD remits and returned-to-merchant delivery-fee deductions, but admins still do not have a real workflow to turn those eligible items into merchant settlements. That leaves settlement data half-modeled in the backend and forces the dashboard and settlements pages to keep placeholder UI that does not match the intended office process.

## What Changes

- Replace the current admin dashboard parcel table with a merchant-settlement workspace that lists merchants who currently have eligible settlement financial items.
- Let an admin open a merchant row into a right-side sheet, review eligible `financial_items`, select multiple items, and generate a merchant settlement from that dashboard flow.
- Create generated settlements with `pending` status so they appear immediately in the merchant settlements listing as awaiting payment resolution.
- Remove the `Create Settlement` button and draft-creation entry point from the settlements listing page because settlement creation moves to the dashboard.
- Let a superadmin resolve a pending settlement from the settlements listing page by uploading a bank transfer receipt and marking the settlement as paid.
- Prepare the dashboard UI structure so merchant settlement is the first settlement tab now, with rider payout tabs added later without another page-level redesign.

## Capabilities

### New Capabilities

- `merchant-settlement-management`: Admin settlement drafting from eligible merchant financial items, pending settlement listing, and superadmin settlement resolution with bank transfer receipt upload.

### Modified Capabilities

- None.

## Impact

- Affects the admin dashboard page under `src/app/dashboard/page.tsx` and settlement listing page under `src/app/dashboard/settlements/page.tsx`.
- Affects settlement feature UI, server actions, DAL queries, DTOs, and validation under `src/features/settlements`.
- Likely requires settlement persistence updates for `pending` workflow fields and bank transfer receipt metadata in `src/db`.
- Affects settlement permissions so admin-level users can create pending settlements while superadmin resolves them.
- Requires product documentation updates for merchant settlement creation and payment confirmation flow.
