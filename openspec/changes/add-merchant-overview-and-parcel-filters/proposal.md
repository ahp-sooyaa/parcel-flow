## Why

Merchant users currently lack a dedicated overview page and can only see an unfiltered parcel table. That makes it harder for merchants to quickly understand COD performance, confirmed remittances, and parcel progress without relying on admin-facing views or manual scanning.

## What Changes

- Add a merchant overview page at `dashboard/merchant/overview` with summary cards for total COD collected, paid-to-you remittance total, total parcels, on-the-way parcels, and delivered parcels.
- Show a merchant-only settlements table below the overview cards that lists only `settled` settlements, with pagination, settlement-code search, and a shadcn date picker filter.
- Extend the merchant parcels page with search by recipient name or phone number, a shadcn date picker filter, status tabs for all/on the way/delivered, and pagination.
- Reuse the established admin parcel and settlement list interaction patterns where they fit merchant self-service browsing.

## Capabilities

### New Capabilities
- `merchant-overview-reporting`: Merchant dashboard overview metrics and settled-settlement history browsing.
- `merchant-parcel-browsing`: Merchant parcel list search, status filtering, date filtering, and pagination.

### Modified Capabilities

## Impact

- Affects merchant dashboard routes under `src/app/dashboard/merchant`.
- Affects parcel and settlement feature DAL queries, DTOs, and UI components under `src/features/parcels` and `src/features/settlements`.
- Requires merchant-scoped server-side filtering, pagination, and aggregate queries derived from parcel, financial item, and merchant settlement data.
- Should stay aligned with the merchant-facing patterns in `docs/parcel-flow-project-spec.md` and the settlement data model in `docs/database-mermaid-diagram.md`.
