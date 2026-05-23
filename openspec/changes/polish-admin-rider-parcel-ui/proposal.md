## Why

Several parcel and admin workflows have small but high-friction UI gaps that now block operators from completing common tasks reliably. This change groups those fixes into one focused polish pass so parcel editing, rider parcel handling, and supporting admin dialogs behave consistently and match the intended workflow.

## What Changes

- Fix the admin parcel edit form so `Save Changes` submits successfully again.
- Keep parcel editing focused on parcel detail fields and leave status changes and rider assignment to their dedicated workflows.
- Add an explicit empty state to the settlements table when no settlement rows exist.
- Move the edit-user `Forgot password` action outside the main form so it can run independently from `Save Changes`.
- Differentiate clickable and disabled checkbox styling so disabled selection controls are visually obvious.
- Restyle the township detail dialog to match the user detail dialog presentation pattern.
- Simplify the assign-rider dialog by removing the extra summary tiles for selected parcel count, total COD amount, total delivery fee, and return-ready parcel count while preserving the expected-collection summary.
- Change rider and admin failure-note viewing to use a textarea field that shows only the current active note text instead of raw array-like JSON/status data.
- Revise the rider parcel-card workflow so cards always render in their expanded state instead of using the previously documented collapsible layout.
- Hide merchant information in the shared parcel detail sheet when the current user is a rider.
- Present the `canceled_returned` parcel status to users as `Canceled` without changing backend values or status logic.

## Capabilities

### New Capabilities
- `admin-rider-ui-polish`: Parcel edit reliability, failure-note presentation cleanup, rider parcel-card simplification, and admin dialog/table consistency improvements across shared parcel workflows.

### Modified Capabilities

## Impact

- Affects parcel feature components under `src/features/parcels/components`, including admin parcel edit UI, rider parcel cards, shared parcel detail sheet, failure-note dialogs, and assign-rider dialog content.
- Affects parcel feature server actions, DTOs, and validation only where needed to support parcel edit submission and textarea-based failure-note text handling.
- Affects settlements, users, and townships feature components for empty-state and dialog/layout consistency updates.
- Aligns the main project spec with the revised rider-card, assignment-summary, and `canceled_returned` display-label behavior introduced by this change.
- Reuses existing Next.js App Router, shadcn/ui, Tailwind, Zod, and feature-sliced structure without introducing new dependencies or architectural layers.
