## Context

Parcel assignment, delivery completion, and failure reporting already mutate shared parcel data on the server, but each dashboard currently reads that data only at request time. As a result, rider parcel lists, admin parcel lists, merchant parcel views, and merchant overview summary cards can remain stale until a manual refresh even though the authoritative parcel rows have already changed.

This change is cross-cutting because it touches admin, rider, and merchant surfaces, introduces a live update delivery pattern on top of server-rendered pages, and requires database-level Supabase realtime configuration. The user has also called out two current infrastructure gaps: realtime is not enabled on the relevant Supabase tables, and there are no RLS policies on those tables yet.

## Goals / Non-Goals

**Goals:**

- Reflect admin rider assignment changes on the assigned rider dashboard and merchant-facing parcel views without manual reload.
- Reflect rider delivery completion and rider failure reporting on admin and merchant views without manual reload.
- Refresh the affected parcel summary cards when those parcel changes alter aggregate counts or totals.
- Keep authorization and business rules unchanged by reusing the existing server actions and parcel mutation logic as the source of truth.
- Introduce the minimum Supabase realtime setup required to deliver authenticated live updates safely within the existing Better Auth model.

**Non-Goals:**

- Changing parcel status rules, assignment rules, settlement logic, payout logic, or delivery failure review flows.
- Replacing existing server-rendered loaders with a client-only data architecture.
- Making every dashboard widget in the system realtime.
- Introducing new backend services, queues, triggers, or event buses beyond Supabase realtime.

## Decisions

### Subscribe to parcel row changes instead of emitting custom events

Use Supabase Realtime `postgres_changes` subscriptions on the `parcels` table as the single live signal for assignment and status updates. The existing server actions remain unchanged; they continue updating parcel rows through the current DAL, and subscribed clients react to inserted update payloads by patching local UI state or triggering a refresh of scoped data.

Rationale: the parcel row is already the canonical source for rider assignment, delivery status, failure notes, and the fields that drive merchant/admin displays. Reusing row changes avoids parallel event-writing logic and keeps the realtime layer additive.

Alternative considered: broadcasting custom channel events from each server action. That would duplicate event payload design across multiple mutations and create drift risk if a row update succeeds but a broadcast path fails.

### Use scoped client wrappers around existing server-rendered pages

Keep the current page-level server components and initial data loaders. Add narrow client components around the parcel list regions and stats card regions that:

- receive server-loaded initial DTOs
- connect to an authenticated live-update stream after hydration
- merge or re-fetch data only for the currently visible surface

Rationale: this preserves the repo’s server-component-first structure, keeps permission filtering on the server, and limits client state to the surfaces that actually need live updates.

Alternative considered: moving the affected pages to full client-side querying. That would expand the change far beyond realtime and would risk leaking business filtering logic into the browser.

### Filter live updates by role scope and revalidate with server data when needed

Each subscribed client should limit the rows it listens to as tightly as the product allows:

- rider views subscribe only to parcels assigned to the authenticated rider
- merchant views subscribe only to parcels belonging to the authenticated merchant
- admin views subscribe to the operational parcel set they already render

For updates that can be applied directly from the payload, patch local parcel items in memory. For aggregate stats cards whose values depend on multiple rows or financial side effects, use the realtime event as an invalidation signal and re-fetch the summary through a server action or route refresh rather than reimplementing aggregation math in the client.

Rationale: row-level patching keeps parcel lists responsive, while server recomputation keeps totals correct and avoids duplicating business calculations in three dashboards.

Alternative considered: recomputing all card totals client-side from cached rows. That only works for the rows the page already has and becomes brittle when metrics depend on filtered datasets or related records.

### Prefer server-mediated live delivery in phase 1 instead of browser-direct Supabase RLS

The current application uses Better Auth session cookies and server-side role checks through `requireCurrentUser`, not Supabase Auth tokens. Phase 1 should therefore avoid assuming browser-direct Supabase Realtime subscriptions secured by Supabase RLS. Instead, the Next.js app should keep the authentication boundary on the server and deliver only already-authorized parcel updates to each connected client.

Rationale: the repo does not currently expose a Supabase browser client, a Supabase auth bridge, or trusted browser-side role/profile claims for realtime. Adding those would expand this change from realtime parcel freshness into a broader authentication redesign.

Alternative considered: adding Supabase-authenticated browser clients and writing direct RLS policies for `parcels`. That can be revisited later, but it is a larger architectural change than this scope requires.

### Publish only the `parcels` table for this phase

Enable Supabase realtime only for the `parcels` table in phase 1. The in-scope rider parcel list, admin parcel list, merchant parcel list, admin parcel summary cards, and merchant overview summary cards can all refresh correctly from parcel-row invalidation without adding `merchant_settlements`, `financial_items`, or payout tables to realtime publication.

Rationale: the admin dashboard parcel summary is derived from `parcels`, and the merchant overview cards touched by this change are also driven by parcel status and parcel collection fields during the requested flows. `paidToYou` depends on settled merchant settlements, but those values do not change during rider assignment, rider delivery completion, or rider failure reporting.

Alternative considered: publishing additional financial tables now to future-proof the design. That would expand the live surface area without providing benefit for the current requested flows.

### Treat stats cards as derived live views, not a new data source

Realtime stats cards should update because the underlying parcel changes invalidate their current snapshot, not because the cards own a separate event pipeline. In scope for this phase are the admin parcel summary cards on `/dashboard` and the merchant overview summary cards on `/dashboard/merchant/overview`. These cards should keep using their existing summary DTO shape and server aggregation logic wherever possible.

Rationale: this keeps the change focused on freshness rather than on redefining reporting calculations.

Alternative considered: creating separate summary tables or triggers for instant card counters. That would introduce new write paths and operational complexity without a clear need for this scope.

## Risks / Trade-offs

- A server-mediated live-update path adds one more application-layer delivery component to maintain -> Keep it feature-local, narrowly scoped to parcel updates, and avoid turning it into a generic event platform.
- Admin parcel lists may receive high update volume compared with rider or merchant views -> Subscribe only on pages that need live behavior and scope handlers to visible datasets rather than global app-wide listeners.
- Realtime payload patching can drift from server-rendered DTO shape if the client tries to reconstruct too much derived data -> Patch only simple parcel fields locally and fall back to server refresh for aggregates or complex view models.
- Subscription lifecycle bugs can cause duplicate listeners after navigation -> Encapsulate channel setup/cleanup in dedicated client hooks/components with deterministic unsubscribe on unmount.
- Enabling realtime on tables without a minimal rollout plan could affect production behavior unexpectedly -> Gate rollout behind database setup steps and verify in a staging or local Supabase environment first.

## Migration Plan

1. Add the required database migration or setup instructions to enable realtime publication for `parcels`.
2. Implement the server-mediated authenticated live-update path that derives viewer scope from the existing Better Auth session and current server-side role/profile lookups.
3. Implement live parcel-list updates on rider, admin, and merchant surfaces using existing DTOs and targeted refresh hooks.
4. Implement live summary-card invalidation and refresh for the admin parcel summary cards and merchant overview summary cards.
5. Validate that assignment, delivery, and failure flows still use the existing server actions unchanged and only gain freshness on connected pages.
6. Roll back by disabling the live-update delivery path in UI code and, if needed, removing `parcels` from realtime publication; core mutations continue to work because they are unchanged.

## Resolved Scope Notes

- The stats-card scope for this phase is limited to the admin parcel summary cards on `/dashboard` and the merchant overview summary cards on `/dashboard/merchant/overview`.
- Phase 1 should not depend on browser-direct Supabase-authenticated subscriptions because the current repo uses Better Auth session cookies rather than Supabase Auth tokens.
- `parcels` is the only table that needs realtime publication for the requested assignment, delivery, and failure-report freshness. Additional financial tables can be evaluated later if settlement or payout views become part of the realtime scope.
