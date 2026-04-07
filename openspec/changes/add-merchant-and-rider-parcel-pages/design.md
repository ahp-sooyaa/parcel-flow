## Context

Parcel Flow already has admin-focused parcel create and update specifications plus self-scope merchant and rider profile routes. The requested change extends parcel workflows to non-admin roles without adding new services: merchant users need their own parcel list inside `/dashboard/merchants/[id]` and must be able to reuse parcel detail/create/edit pages for their own parcels, while rider users need a simplified parcel detail view and a conditional next-step action workflow.

Constraints:
- Keep the Next.js monolith and feature-sliced structure.
- Enforce authorization on the server and fail closed by default.
- Reuse existing parcel pages where possible instead of forking route trees.
- Keep money-adjacent fields explicit and avoid exposing unnecessary financial detail to riders.
- Preserve admin-only controls where policy remains stricter, such as broader parcel access and cancellation authority.

Stakeholders:
- Merchant users who manage only their own parcel intake and corrections.
- Rider users who need clear last-mile delivery actions with minimal UI noise.
- Admin and operations staff who still need full parcel workflows without regression.

## Goals / Non-Goals

**Goals:**
- Add merchant-scoped parcel list access on the merchant self-detail page without requiring `parcel-list.view`.
- Reuse shared parcel detail/create/edit pages for merchant users while enforcing merchant ownership in DAL and actions.
- Add rider parcel detail access with a dedicated rider-focused presentation and server-validated next-step actions.
- Keep authorization logic centralized and auditable across admin, merchant, and rider parcel access paths.

**Non-Goals:**
- Creating a separate rider parcel edit workflow.
- Allowing rider users to create or edit parcels.
- Introducing new backend layers, background jobs, or external services.
- Redesigning parcel accounting rules beyond the rider workflow actions needed for this phase.

## Decisions

### Decision: Keep one parcel feature slice and make scope resolution role-aware
Parcel reads and mutations will stay in `src/features/parcels/*`, but DAL entry points will accept an actor context that resolves one of three scopes: admin/global, merchant-owned, or rider-assigned.

Rationale:
- Keeps business rules in one feature and avoids duplicate parcel logic in merchant or rider modules.
- Makes self-scope filtering explicit at the server boundary where data access is authoritative.

Alternatives considered:
- Separate parcel modules for admin, merchant, and rider.
- Rejected because it would duplicate validation, DTO shaping, and route coordination.

### Decision: Reuse shared parcel routes with role-specific data shaping and UI branches
Existing parcel detail/create/edit routes will remain the canonical route structure. Server page loaders will determine actor scope first, then use DTO shaping to expose only the fields needed for that role. The detail UI will branch by actor role so riders receive a focused operational layout while admin and merchant users continue to use the richer shared page.

Rationale:
- Reduces route sprawl and keeps parcel URLs stable.
- Supports different UI needs without duplicating the underlying parcel retrieval logic.

Alternatives considered:
- Creating separate `/dashboard/rider-parcels/*` routes.
- Rejected because the user explicitly wants route reuse and shared page foundations.

### Decision: Merchant parcel list belongs to merchant detail composition, not a separate merchant-only parcel index
Merchant users will reach parcel list data through `/dashboard/merchants/[id]`, where the page composes merchant detail data plus a parcel list query filtered by the linked merchant record. This path will require `merchant.view` but not `parcel-list.view`.

Rationale:
- Matches the requested workflow and existing merchant self-navigation pattern.
- Keeps merchant access narrow and avoids introducing a broader parcel directory for merchants.

Alternatives considered:
- Adding a dedicated merchant parcel list route.
- Rejected because it would widen navigation surface area and weaken the requested self-detail-centric workflow.

### Decision: Rider actions are conditional next-step transitions with strict assignment checks
Rider parcel detail will compute the next available rider action from the current parcel status and assignment. For example, a parcel in `pending` state should show a pickup-oriented action rather than `delivered`. Each rider action will call a dedicated parcel server action that validates the rider's linked profile, confirms parcel assignment, and applies only the allowed transition for that current status. These actions will not reuse the general parcel edit contract.

Rationale:
- Prevents riders from gaining broader mutation power through shared edit payloads.
- Keeps each allowed transition easy to audit and test.
- Matches the actual parcel lifecycle more closely than a single hardcoded deliver action.

Alternatives considered:
- Letting riders use the parcel edit form with hidden fields.
- Rejected because it broadens mutation surface and increases risk of accidental or unauthorized changes.

### Decision: Merchant parcel create shows merchant as read-only while server stays authoritative
The shared parcel create page for merchant users will display the merchant field as read-only for clarity, but the server will still derive and validate merchant ownership from the authenticated session instead of trusting the submitted value.

Rationale:
- Keeps the form understandable for merchant users without letting the client control ownership.
- Preserves fail-closed behavior even if the read-only UI is bypassed.

Alternatives considered:
- Hiding the merchant field entirely.
- Rejected because the user asked for visible clarity in the create flow.

### Decision: Rider DTOs must omit non-essential financial/admin fields
Rider detail shaping will include only fields needed for delivery execution, such as parcel type, COD versus non-COD state, collectable amount, recipient/delivery context, and current delivery status. Settlement, payout, and broader admin-edit metadata remain excluded from rider-facing payloads unless explicitly required later.

Rationale:
- Aligns with least-privilege access and keeps rider UI operationally clear.
- Reduces the chance of exposing accounting-sensitive data that riders do not need.

Alternatives considered:
- Returning the full admin parcel detail object and hiding fields in the UI.
- Rejected because client-side hiding is not sufficient for sensitive data control.

## Risks / Trade-offs

- [Risk] Shared parcel routes can accumulate role-specific conditionals and become harder to follow. → Mitigation: keep role branching close to DTO/page composition boundaries and keep core DAL filters explicit.
- [Risk] Merchant self-scope queries could accidentally fall back to broad parcel list behavior. → Mitigation: require actor scope input for merchant parcel DAL paths and test cross-merchant denial cases.
- [Risk] Rider next-step actions may be underspecified around allowed source statuses. → Mitigation: define an explicit transition map in server utils and keep ambiguous transitions fail-closed.
- [Trade-off] Reusing shared parcel pages speeds delivery but constrains how different the rider UI can become without later refactoring. → Mitigation: isolate rider-specific view sections so a dedicated route can be introduced later if needed.

## Migration Plan

1. Extend parcel DAL/DTO/utils to support actor-aware scope resolution for admin, merchant, and rider access.
2. Add merchant detail composition for merchant-owned parcel listing and parcel entry points.
3. Update shared parcel detail/create/edit routes to authorize merchant self-scope access and deny rider create/edit access.
4. Add rider parcel detail presentation and rider next-step server actions.
5. Verify admin behavior remains intact and run targeted role-based checks for merchant and rider flows.

Rollback strategy:
- Revert the route/page composition and role-aware parcel access changes if needed.
- Because this change is behavior-focused rather than schema-heavy, rollback is primarily application-code rollback with no special data migration expected.

## Open Questions

- None currently. Rider actions will be conditional next-step transitions based on parcel status plus rider assignment, and the merchant field on merchant parcel create will be shown as read-only while ownership remains server-derived.
