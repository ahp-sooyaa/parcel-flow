## Why

Riders can report delivery failures, but super admins and office admins need a clear operational workflow to review those reports, choose whether to retry later or return to merchant, and release the current rider from the expected collection burden. This change closes the admin-side failure handling gap without giving riders direct control over final failure status decisions.

## What Changes

- Show a red warning icon beside a parcel code in the admin parcel list when the parcel has a rider failure note that still needs admin review.
- Open a dialog from the warning icon that displays the stored failure note and provides `Postpone` and `Return Merchant` actions.
- Let super admins and office admins choose `Postpone` to move an eligible failed parcel to `postpone`, clear the current rider assignment, and remove that parcel from the rider expected collection amount.
- Let super admins and office admins choose `Return Merchant` to move an eligible failed parcel to `canceled_returned`, clear the current rider assignment, and remove that parcel from the rider expected collection amount.
- Preserve the intended re-assignment model: unassigned postponed parcels can be assigned to a rider for retry, and that assignment automatically changes the parcel back to `at_office`; `canceled_returned` parcels can be assigned to a rider for return handling without changing status.
- Keep rider failure reporting separate from admin review; riders continue to write `delivery_failure_note` without changing parcel status.

## Capabilities

### New Capabilities
- `admin-failure-parcel-management`: Admin review and resolution of rider-reported failed delivery parcels, including warning indicators, failure-note review, failure status actions, assignment clearing, and readiness for later re-assignment.

### Modified Capabilities
- None.

## Impact

- Admin parcel list UI and row actions in the parcel feature.
- Failure-review dialog components under `src/features/parcels/components`.
- Parcel server actions and DAL methods for admin-only failure resolution and status preparation.
- Parcel DTOs/read models to expose failure-note review state and warning indicator data.
- Rider expected collection calculations, which must immediately exclude parcels after failure resolution clears assignment.
- Parcel status logs for admin failure decisions.
- Tests covering authorization, status eligibility, assignment clearing, expected collection changes, and admin UI behavior.
