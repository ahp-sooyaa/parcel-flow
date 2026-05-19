## Context

`/dashboard/rider/parcels` is currently a server page that loads rider-scoped parcels with `listParcelsForRiderUser(currentUser.id)` and renders the shared `ParcelTable`. That table is useful for admin parcel management, but it exposes a dense desktop table pattern and does not provide rider-specific delivery actions. The project spec allows riders to view assigned parcels, search/filter them, start delivery by moving assigned parcels from `at_office` to `on_the_way`, and see assigned `canceled_returned` parcels as return work.

This change stays inside the existing Next.js monolith and feature-sliced parcels module. Server-side scoping remains mandatory: riders must only read and mutate parcels assigned to their rider account.

## Goals / Non-Goals

**Goals:**

- Replace `ParcelTable` on `/dashboard/rider/parcels` with a rider-specific card list.
- Provide mobile-first collapsed cards with progressive disclosure for delivery details.
- Support tabs, search, township/status filters, multi-select, pagination, and a full-size detail sheet.
- Add a protected rider start-delivery mutation for one or more assigned `at_office` parcels.
- Show `Report Failure` and `Mark Delivered` buttons for assigned `on_the_way` parcels without wiring their mutations in this change.
- Reuse existing DTOs, status labels, formatting helpers, shadcn primitives, and DAL patterns where practical.

**Non-Goals:**

- Do not redesign admin or merchant parcel pages.
- Do not remove `ParcelTable` from admin workflows.
- Do not implement report-failure, mark-delivered, admin postpone/canceled/returned decision flows, delivered side effects, settlement, or payout side effects in this change.
- Do not add a new pagination dependency or separate backend/API layer.
- Do not decide the final contents of the parcel detail sheet beyond opening it from the rider card flow.

## Decisions

### Build a rider-specific client component

Create a rider-specific component, such as `RiderParcelCardList`, under `src/features/parcels/components`. The route remains a server component responsible for authentication and rider-scoped data loading, then passes parcels into the client component for search/filter/card expansion state.

Alternative considered: add card mode to `ParcelListView` or `ParcelTable`. That would couple admin assignment behavior to rider delivery behavior and make the shared table harder to maintain.

### Keep filtering client-side for this iteration

Use the currently loaded rider-scoped parcel DTO array for tab filtering, search, township filtering, status filtering, selection cleanup, and pagination. This matches the current admin parcel list pattern and avoids introducing query-string state or server pagination before the dataset requires it.

Alternative considered: add server-side filtering and pagination immediately. That is more scalable but adds DAL contract changes and URL/state complexity outside the requested UI replacement.

### Treat tabs as primary rider work buckets

Use two tab buckets: `to_deliver` for rider-assigned parcels with status `at_office`, `on_the_way`, or `canceled_returned`, and `delivered` for parcels with status `delivered`. Search, township, and status filters apply within the active tab. If a status filter conflicts with the selected tab, the result can be empty rather than silently overriding the rider's selected filter.

Alternative considered: make `to_deliver` include every non-delivered parcel. That would incorrectly include `postpone`, which should be unassigned while admin decides or prepares a retry.

### Restrict bulk start delivery to eligible cards

Only `at_office` parcels assigned to the current rider are selectable for the start-delivery batch action. Assigned `canceled_returned` parcels remain visible as return work but are not changed to `on_the_way` by the start-delivery action. Non-eligible parcels still render in the list but have disabled selection and no start-delivery button. The server action must re-check rider ownership, current status, and the `rider` role before updating rows.

Alternative considered: allow selection of all visible parcels and reject the mixed batch on submit. Disabling ineligible cards gives clearer feedback and reduces avoidable server errors.

### Use existing sheet and action patterns

Use shadcn `Sheet` with full-width and full-height right-side content for details. The card detail link should be visually lightweight and underlined, not a primary CTA. Existing `ParcelDetailSheet` can be reused initially unless implementation needs a rider-specific detail component later.

Alternative considered: create a new detail view now. The user has not decided the detail contents yet, so reusing the existing detail surface avoids committing to a premature layout.

### Add a focused DAL/action for status transition

Add a parcel server action such as `startDeliveryForRiderParcelsAction` and DAL helper that update `status`, `updatedAt`, and any existing status timestamp/log fields if present. This action must use `canChangeParcelStatus(actor.role, "at_office", "on_the_way")` and must join through the rider profile to ensure the selected parcels belong to the current rider.

Alternative considered: expose a generic status-change action now. The full parcel status workflow has more side effects and permissions, so a focused start-delivery action is safer for this change.

### Show future status actions without wiring them

For assigned `on_the_way` parcels, show `Report Failure` and `Mark Delivered` buttons so the rider card layout reserves the expected workflow controls. These buttons should not submit mutations in this change; they can be disabled or otherwise presented as unavailable until later OpenSpec changes wire the actual actions and side effects.

Alternative considered: hide those buttons until the actions exist. Showing the affordances now makes the rider card design easier to validate while keeping business logic scope limited to start delivery.

## Risks / Trade-offs

- Client-side pagination can become inefficient for very large rider parcel lists -> Keep the component state isolated so it can later move to URL/server-backed pagination without affecting unrelated pages.
- Collapsible cards can conflict with checkbox and detail-link clicks -> Stop propagation for checkbox and link interactions and provide explicit accessible labels.
- Batch action can race with admin status changes -> Re-validate current status and rider ownership inside the transaction before updating.
- Future action buttons can look broken if they are interactive without mutations -> Render them as disabled or clearly unavailable until their OpenSpec changes wire behavior.
- Existing DTOs may not include every future detail field -> Use the current DTO for the card and detail sheet now, and extend DTO mapping only when the chosen detail content requires it.
- Filtering by status inside a tab can produce empty states -> Show an empty state that makes clear no parcels match current search and filters.
