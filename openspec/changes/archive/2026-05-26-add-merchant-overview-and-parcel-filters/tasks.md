## 1. Merchant overview data and routing

- [x] 1.1 Add merchant overview route entrypoint at `src/app/dashboard/merchant/overview/page.tsx` and parse URL search params for settlement history filters and pagination.
- [x] 1.2 Add merchant-scoped settlement history DTOs and DAL query helpers for settled-only search, created-date filtering, and paginated results.
- [x] 1.3 Add merchant-scoped aggregate query helpers for overview cards covering total COD collected, paid-to-you remittances, total parcels, on-the-way parcels, and delivered parcels.

## 2. Merchant overview UI

- [x] 2.1 Build the merchant overview stats-card section using the existing dashboard visual language.
- [x] 2.2 Build a merchant-facing settled-settlement table with settlement-code search, shadcn date picker filter, empty states, and pagination controls.
- [x] 2.3 Ensure the merchant overview page hides admin-only settlement actions and only exposes merchant-safe settlement information.

## 3. Merchant parcels query support

- [x] 3.1 Add merchant parcel filter DTOs and DAL query helpers for recipient name/phone search, created-date filtering, status tabs, and paginated results.
- [x] 3.2 Update the merchant parcels route to parse search params and request filtered paginated parcel data instead of the current full list loader.

## 4. Merchant parcels UI

- [x] 4.1 Add a merchant parcel toolbar with search input, shadcn date picker filter, and status tabs for all, on the way, and delivered.
- [x] 4.2 Add pagination controls and merchant-appropriate empty states to the parcel list view while preserving existing parcel detail access patterns.
- [x] 4.3 Reuse or adapt current parcel table presentation so merchant pages omit irrelevant admin-only controls.

## 5. Verification

- [x] 5.1 Verify merchant ownership checks remain server-enforced for overview, settlement history, and parcel queries.
- [x] 5.2 Run lint and typecheck after implementation and resolve any issues introduced by the merchant overview and parcel browsing changes.
