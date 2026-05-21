## Context

Parcel Flow already separates rider failure reporting from final failure decisions. A rider reports a delivery failure while the parcel remains `on_the_way`, stores the reason in `parcels.delivery_failure_note`, and leaves the current rider assignment in place until an admin reviews the report.

The admin parcel list is the natural review surface because super admins and office admins already manage parcel status, rider assignment, and operational follow-up there. The implementation must keep business decisions on the server, use the existing Next.js monolith and feature-sliced parcel structure, and avoid creating new services or client-side authority for status changes.

## Goals / Non-Goals

**Goals:**

- Surface rider-reported failed parcels in the admin parcel table with a compact red warning icon beside the parcel code.
- Let admins review the failure note in a dialog and choose either `Postpone` or `Return Merchant`.
- Enforce server-side authorization and status eligibility for failure decisions.
- Clear the current rider assignment when the admin chooses either failure decision.
- Make rider expected collection calculations immediately exclude the unassigned failed parcel.
- Preserve the existing assignment model for later retry or return handling.

**Non-Goals:**

- No rider-side redesign beyond relying on the existing failure note field.
- No new parcel statuses beyond `postpone` and `canceled_returned`.
- No automatic reassignment after a failure decision.
- No merchant settlement fee deduction when the admin chooses `Return Merchant`; deduction is created only when the parcel is physically `returned_to_merchant`.
- No bulk failure review in this change.

## Decisions

1. Use `delivery_failure_note` plus status/assignment state to drive the warning indicator.

   A parcel should show the warning icon when it is `on_the_way`, has a non-empty `delivery_failure_note`, and still has an assigned rider. This matches the current lifecycle: a rider has reported a failure and an admin decision is pending. An alternative would be adding a dedicated `failure_review_status` field, but the existing status flow is sufficient for MVP and avoids a migration.

2. Add explicit admin server actions for failure decisions.

   The UI should call parcel feature server actions such as `postponeFailedParcelAction` and `returnFailedParcelAction`. Each action validates the current user role, validates the parcel is still eligible, updates the parcel in one transaction, and writes a status log. This keeps permission checks and business rules server-side instead of trusting hidden UI controls.

3. Treat `Return Merchant` in the review dialog as the business decision to enter `canceled_returned`.

   The button label should use the operator-friendly wording from the requested UI, but the persisted status should be `canceled_returned`, meaning the parcel is ready for return handling but has not yet been physically returned. The final `returned_to_merchant` transition and delivery fee deduction remain a later operational step.

4. Clear `rider_id` and `assigned_at` for both decisions.

   Clearing the assignment releases the current rider from the parcel and removes the parcel from rider-scoped lists. Expected collection should not require a stored aggregate update if it is calculated from currently assigned active parcels; any read model must exclude unassigned parcels immediately after the transaction.

5. Preserve current assignment eligibility for follow-up work.

   Unassigned postponed parcels are assignable when the admin is ready to retry. During assignment, the parcel should automatically move from `postpone` back to `at_office`, so the rider receives it as normal delivery work and the delivery flow restarts from the initial delivery-ready state. Return-ready parcels remain `canceled_returned` when assigned because they are return work, not normal delivery work.

## Risks / Trade-offs

- Stale review dialog submission -> Revalidate status and assignment in the server action and return a clear validation error if another admin already handled the parcel.
- Warning icon noise after review -> Only show the icon for pending failed review state, not merely any historical failure note.
- Ambiguous `Return Merchant` wording -> Label the action as requested but confirm in UI copy/status feedback that the parcel is marked for return handling, not physically returned.
- Expected collection inconsistency -> Keep expected collection derived from assigned active parcels and cover the unassignment side effect with tests.
- Duplicate side effects -> Run status update, assignment clearing, and status log insertion in a single DAL transaction.
