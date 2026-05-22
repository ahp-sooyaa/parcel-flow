## Why

The current `delivery_failure_note` field only stores a single text value, so the system loses failure-note history and cannot explicitly track whether an admin has already resolved a rider-reported failure. We need a structured failure-note model so riders can see whether a parcel still has an active unresolved failure report and admins can review unresolved parcels from a dedicated queue.

## What Changes

- Change `parcels.delivery_failure_note` from a single text field to a JSONB collection of failure note entries, each storing the note text and a status such as `active` or `inactive`.
- Save new rider-submitted failure notes as appended JSONB entries with `status = active` while keeping the parcel in `on_the_way`.
- When an admin resolves a failed delivery by choosing `postpone` or `canceled_returned`, mark the active failure note entry as `inactive` as part of the same resolution flow.
- Update the rider parcel card actions so parcels with an active failure note show `View Failure Note` and hide `Report Failure` and `Mark Delivered`; parcels without an active failure note continue to show `Report Failure` and `Mark Delivered`.
- Add a `Need review` tab to the admin parcel listing that filters parcels with an active failure note so operators can review unresolved failures quickly.
- Preserve existing assignment-clearing and status-transition behavior for admin failure resolution.

## Capabilities

### New Capabilities
- `parcel-failure-note-lifecycle`: Structured parcel failure note history, unresolved-note state, rider action gating, and admin review filtering for failed delivery workflows.

### Modified Capabilities
- None.

## Impact

- Database schema and migration for `parcels.delivery_failure_note`, including data backfill from text to JSONB.
- Parcel DAL, DTOs, and server actions that read, append, and resolve failure notes.
- Rider parcel card UI and failure-note dialog behavior.
- Admin parcel listing tabs, filters, and failure review UI.
- Tests covering migration behavior, authorization, active-note filtering, rider button visibility, and admin resolution side effects.
