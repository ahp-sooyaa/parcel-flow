## Why

Rider users currently see assigned parcels through the shared admin-oriented parcel table, which is dense and does not match the rider delivery workflow. The rider parcels page needs a mobile-first card experience that supports quick scanning, filtering, multi-select, and starting delivery for assigned parcels.

## What Changes

- Replace the `/dashboard/rider/parcels` table usage with a rider-specific collapsible parcel card list.
- Add tab filtering for rider parcel work buckets: `To Deliver` and `Delivered`.
- Add search and filter controls similar to `/dashboard/parcels`, with township and status filters for rider-scoped parcels.
- Add pagination for the rider parcel card list.
- Show rider parcel cards in one column on mobile and three to four columns on desktop.
- Keep card default state compact, showing parcel code, recipient name, current status, and a multi-select checkbox.
- Expand a card on click to show recipient phone, recipient address, amount to collect, start-delivery action, and an underlined detail link.
- Add a rider-scoped start-delivery action that changes selected assigned parcels from `at_office` to `on_the_way`.
- Show `Report Failure` and `Mark Delivered` buttons for assigned `on_the_way` parcels as UI affordances, but defer wiring those actions to later OpenSpec changes.
- Include assigned `canceled_returned` return-work parcels in the rider `To Deliver` tab while keeping their status unchanged.
- Open parcel details from an underlined link in a full-width, full-height shadcn right-side sheet.
- Remove `ParcelTable` usage from the rider parcels page while keeping the shared table available for admin and merchant contexts.

## Capabilities

### New Capabilities

- `rider-parcel-card-workflow`: Rider-facing assigned parcel browsing, filtering, card expansion, multi-select, detail sheet access, pagination, start-delivery status changes, and future-action affordances.

### Modified Capabilities

- None.

## Impact

- Affects `/dashboard/rider/parcels`.
- Adds rider-specific parcel list UI under `src/features/parcels/components`.
- Adds or extends parcel server action and DAL logic for rider-scoped `at_office -> on_the_way` status updates.
- Reuses existing parcel DTOs, status labels, formatting utilities, shadcn components, and rider-scoped DAL queries where practical.
- No new dependencies, backend services, or root-level architectural folders are required.
