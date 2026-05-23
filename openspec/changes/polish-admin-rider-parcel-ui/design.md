## Context

This change touches several existing UI surfaces across parcels, settlements, users, and townships, but the highest-risk issue is the broken admin parcel edit flow. The codebase already uses feature-sliced Next.js components with server actions and shared DTOs, so the safest implementation path is to repair and extend the existing forms and dialogs instead of introducing new abstractions or parallel variants.

The parcel feature is shared across admin and rider dashboards. That means some requested behavior is role-specific, especially for parcel detail presentation and failure-note handling, and needs to be implemented without splitting the entire component tree by role.

This change also intentionally revises a few previously documented UX details: rider parcel cards are no longer collapsible by default, the assign-rider dialog summary is reduced to expected-collection figures, and the frontend display label for `canceled_returned` becomes `Canceled` while the stored status remains unchanged.

## Goals / Non-Goals

**Goals:**

- Restore a working admin parcel edit submission flow without expanding it into status-change or rider-assignment workflow management.
- Normalize failure-note display so admin and rider users see textarea-based active note text, not serialized note history.
- Simplify the rider parcel card experience by removing card collapse state and keeping operational actions visible in the default card layout.
- Apply the requested UI consistency changes for settlements empty state, edit-user password reset placement, checkbox disabled styling, township detail dialog styling, assign-rider summary density, and parcel status labeling.
- Keep permission checks, status transitions, and parcel assignment rules on the existing server actions and DAL paths.

**Non-Goals:**

- No database schema changes for parcels, settlements, users, or townships.
- No backend status rename for `canceled_returned`; the display-only label changes only in frontend presentation.
- No redesign of rider parcel filtering, pagination, or selection rules beyond the requested always-expanded layout and presentation cleanup.
- No new role-specific parcel detail component unless the existing shared sheet becomes structurally unworkable.

## Decisions

1. Repair parcel editing by wiring the existing sheet form to a dedicated update action without turning the sheet into a workflow-management surface.

   The current `edit-parcel-form` already owns the merchant, receiver, township, fee, note, and COD inputs. The lower-risk solution is to make those edits save correctly while leaving parcel status transitions and rider assignment in their dedicated workflows. That keeps the edit sheet focused on parcel details and avoids overlapping business rules with failure resolution and rider assignment.

2. Treat failure-note viewing and editing surfaces as active-note text presentation, not raw note-history presentation.

   The parcel model stores failure-note history as an array of note objects with `active` or `inactive` status. The UI should continue to read and write only the active note text where failure-note edits are already supported, and should show that same active note text in textarea form for admin review surfaces, leaving history shaping in the parcel failure-note helpers and DAL. The alternative would expose note-history structure in the UI, but that conflicts with the requested UX and leaks implementation details.

3. Keep shared parcel detail and status presentation role-aware through lightweight presentation inputs.

   Hiding merchant information for riders and renaming the `canceled_returned` label to `Canceled` are presentation concerns that should be handled close to the shared display components or shared formatting helpers. This avoids duplicating parcel cards or sheet layouts per role. The alternative would fork the shared components for rider/admin, which is unnecessary for a small set of conditional rows and labels.

4. Remove rider parcel collapse state instead of simulating permanent expansion.

   The rider parcel card list currently manages expanded-card state and click-to-toggle interaction. The cleanest solution is to remove the expansion state and render the details/action section inline for every card, while keeping selection, start-delivery, failure, and return actions unchanged. Leaving the collapse mechanics in place but forcing all cards open would retain dead code and confusing click behavior.

5. Apply UI consistency fixes in-place within each feature component.

   The settlements empty state, user-sheet password reset placement, township dialog styling, assign-rider summary trimming, and checkbox disabled differentiation are all local surface improvements. They should be handled directly in their owning components and existing shared field primitives where possible. The alternative would be introducing new cross-feature design wrappers, which would be disproportionate to the scope.

## Risks / Trade-offs

- Broken parcel edit save path -> Reuse existing server validation patterns and add targeted verification for parcel-detail-only updates.
- Failure-note editing could accidentally overwrite history incorrectly -> Limit the UI to active-note text and keep append/update/deactivate logic inside existing parcel failure-note helpers and server actions.
- Role-aware parcel detail changes could drift between admin and rider views -> Keep one shared component with explicit role-based conditional sections instead of maintaining two divergent implementations.
- Checkbox styling divergence could become inconsistent across tables and cards -> Make the visual distinction through shared checkbox class usage or a narrow shared styling helper rather than ad hoc per-screen overrides.
- Simplifying assign-rider metrics may remove data some operators relied on -> Preserve the core expected-collection figures that drive assignment decisions and remove only the explicitly requested summary tiles.

## Migration Plan

No data migration or deployment sequencing is required. Rollback is a standard frontend/server-action revert because the change preserves existing persisted parcel statuses, failure-note storage format, and settlement/user/township data contracts.

## Open Questions

- None at proposal time. The requested behaviors are specific enough to implement without further product clarification.
