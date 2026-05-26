## Why

Admin, rider, and merchant users currently rely on manual reloads to see parcel assignment and delivery outcome changes. That creates stale parcel queues and stale summary cards during normal operations, even though the underlying business actions already exist and should be visible immediately to every affected role.

## What Changes

- Add realtime parcel synchronization so admin rider assignment changes appear on the assigned rider view and merchant view without page reload.
- Add realtime parcel synchronization so rider delivery completion and rider failure reporting appear on admin and merchant views without page reload.
- Add realtime stats card refresh for the parcel summary cards affected by those parcel changes.
- Enable Supabase realtime for the required database tables and document the minimal publication and RLS policy setup needed for these subscriptions.
- Keep all existing parcel mutation logic, permissions, status transitions, and financial side effects unchanged.

## Capabilities

### New Capabilities

- `realtime-parcel-sync`: Cross-role realtime parcel row updates and realtime stats card refresh for admin, rider, and merchant dashboards.

### Modified Capabilities

## Impact

- Affects parcel, dashboard, and merchant-facing routes and components under `src/app` and `src/features`.
- Adds client-side Supabase realtime subscriptions and server-side DTO/query shaping needed to apply live updates safely.
- Requires enabling Supabase realtime for selected tables and adding RLS policies compatible with authenticated admin, rider, and merchant subscriptions.
- Does not add new business workflows or change existing mutation/action semantics.
