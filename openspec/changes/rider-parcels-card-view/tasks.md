## 1. Server Start-Delivery Action

- [x] 1.1 Add rider-scoped DAL logic to update selected assigned parcels from `at_office` to `on_the_way`.
- [x] 1.2 Add a server action for rider start-delivery requests with Zod validation, role checks, ownership checks, and path revalidation.
- [x] 1.3 Ensure the start-delivery mutation rejects non-rider actors, unrelated parcels, missing parcels, and parcels whose status is not `at_office`.

## 2. Rider Page Wiring

- [x] 2.1 Update `/dashboard/rider/parcels` to stop rendering `ParcelTable`.
- [x] 2.2 Keep the page as a server component that requires the current rider user and loads parcels with the rider-scoped DAL query.
- [x] 2.3 Render a new rider-specific card list component from the rider page.

## 3. Rider Card List UI

- [x] 3.1 Create a client component for rider parcel cards under `src/features/parcels/components`.
- [x] 3.2 Implement responsive card layout with one mobile column and three to four desktop columns.
- [x] 3.3 Implement collapsed card state showing parcel code, recipient name, status, and selection checkbox.
- [x] 3.4 Implement card expansion on card body click with phone number, recipient address, amount to collect, status-appropriate action, and detail link.
- [x] 3.5 Show non-wired `Report Failure` and `Mark Delivered` buttons on expanded `on_the_way` cards.
- [x] 3.6 Prevent checkbox, action button, and detail-link clicks from unintentionally toggling card expansion.

## 4. Search, Filters, Tabs, and Pagination

- [x] 4.1 Add `To Deliver` and `Delivered` tab filtering, with `To Deliver` including assigned `at_office`, `on_the_way`, and `canceled_returned` parcels.
- [x] 4.2 Add search across parcel code, recipient name, and recipient phone number.
- [x] 4.3 Add township and status filters using existing shadcn-style controls and parcel status labels.
- [x] 4.4 Add pagination controls for the filtered card list.
- [x] 4.5 Reset pagination to the first page when tab, search, township filter, or status filters change.
- [x] 4.6 Add empty states for no assigned parcels and no parcels matching current filters.

## 5. Selection and Batch Start Delivery

- [x] 5.1 Enable start-delivery card checkboxes only for assigned parcels whose current status is `at_office`.
- [x] 5.2 Keep selected parcel IDs synchronized when filters, pagination, or parcel eligibility change.
- [x] 5.3 Add a batch action surface for selected parcels that submits selected IDs to the rider start-delivery action.
- [x] 5.4 Update the single-card `Start Delivery` button to submit only that parcel through the same action path.

## 6. Deferred Action Affordances

- [x] 6.1 Keep `Report Failure` and `Mark Delivered` buttons non-mutating in this change.
- [x] 6.2 Ensure the deferred buttons do not call server actions or update parcel status.

## 7. Detail Sheet

- [x] 7.1 Add an underlined detail link to expanded cards.
- [x] 7.2 Open details in a full-width and full-height shadcn right-side sheet.
- [x] 7.3 Reuse the existing parcel detail sheet initially unless implementation reveals a rider-specific detail component is necessary.

## 8. Verification

- [x] 8.1 Run lint after implementation.
- [x] 8.2 Run typecheck after implementation.
- [x] 8.3 Manually verify the rider parcels page on desktop and mobile widths for card columns, expansion, filtering, selection, detail sheet, start-delivery behavior, and deferred `Report Failure` / `Mark Delivered` buttons.
