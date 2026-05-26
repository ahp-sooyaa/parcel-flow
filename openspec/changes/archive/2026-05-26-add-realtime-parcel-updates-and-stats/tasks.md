## 1. Database Realtime and Access Setup

- [x] 1.1 Identify the minimum table set required for this change, starting with `parcels`, and document whether any additional tables need realtime publication for stats refresh.
- [x] 1.2 Add the database migration or setup script that enables Supabase realtime publication for the scoped table set.
- [x] 1.3 Add explicit RLS `SELECT` policies for admin, rider, and merchant parcel visibility that match the current server-side access model.
- [x] 1.4 Verify that authenticated subscriptions can receive allowed parcel updates and do not expose rows outside each role's scope.

## 2. Realtime Client Infrastructure

- [x] 2.1 Add or extend the shared Supabase browser client support needed for authenticated realtime subscriptions in the Next.js app.
- [x] 2.2 Create a feature-local realtime subscription utility or hook for parcel row changes with deterministic subscribe and cleanup behavior.
- [x] 2.3 Define how realtime payloads map to existing parcel DTO fields so simple row changes can patch visible parcel state safely.

## 3. Dashboard Realtime Integration

- [x] 3.1 Wire rider parcel views to subscribe to rider-scoped parcel updates so assignment, delivery completion, and failure-note changes appear without manual reload.
- [x] 3.2 Wire admin parcel views to subscribe to operational parcel updates so rider assignment and rider delivery outcomes appear without manual reload.
- [x] 3.3 Wire merchant parcel views to subscribe to merchant-scoped parcel updates so assignment and delivery outcomes appear without manual reload.
- [x] 3.4 Wire the in-scope stats card surfaces to refresh from realtime parcel invalidation without reimplementing business calculations in the client.

## 4. Freshness Without Business Logic Changes

- [x] 4.1 Reuse the existing parcel assignment and rider delivery server actions unchanged as the mutation source of truth.
- [x] 4.2 Ensure realtime list updates and stats refresh preserve current filtering, pagination, and role-based display behavior on each affected page.
- [x] 4.3 Ensure pages without active realtime subscriptions keep their current request-time behavior and do not regress.

## 5. Tests and Verification

- [x] 5.1 Add automated coverage for role-scoped realtime parcel updates across rider, admin, and merchant views where feasible.
- [x] 5.2 Add automated coverage that merchant summary cards refresh correctly after relevant realtime parcel changes.
- [x] 5.3 Add automated coverage or lower-level verification for the RLS-backed subscription access boundaries.
- [x] 5.4 Run lint, typecheck, and the relevant test suites after implementation.
- [x] 5.5 Manually verify admin-to-rider assignment updates, rider-to-admin delivery updates, and rider-to-merchant delivery updates in a Supabase environment with realtime enabled.
