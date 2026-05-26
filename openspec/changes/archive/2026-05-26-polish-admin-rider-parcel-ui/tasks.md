## 1. Parcel Edit Flow

- [x] 1.1 Inspect the current parcel edit sheet and server paths to identify why `Save Changes` does not persist updates.
- [x] 1.2 Add or repair the parcel update server action, Zod input, and DAL mutation needed for editing an existing parcel safely.
- [x] 1.3 Keep the parcel edit form limited to parcel detail fields and remove status/rider workflow controls from that sheet.
- [x] 1.4 Revalidate the affected parcel admin views after a successful parcel edit submission.

## 2. Failure Notes and Rider Parcel Presentation

- [x] 2.1 Update rider failure-note dialog rendering to bind the textarea to active failure-note text only and keep it editable.
- [x] 2.2 Update the admin failure-note review surface so it uses the same textarea-based active-note presentation instead of serialized note-history content.
- [x] 2.3 Remove collapse/expand state from the rider parcel card list and render cards in their detailed layout by default.
- [x] 2.4 Hide merchant information in the shared parcel detail sheet when the current actor is a rider.
- [x] 2.5 Change frontend parcel-status label presentation so `canceled_returned` renders as `Canceled`.

## 3. Admin UI Consistency Improvements

- [x] 3.1 Add a settlements-table empty state for the no-data case.
- [x] 3.2 Move the edit-user `Forgot password` action outside the account-details save form while keeping its current behavior intact.
- [x] 3.3 Adjust checkbox styling so disabled checkboxes look distinct from enabled clickable checkboxes.
- [x] 3.4 Restyle the township detail dialog to follow the same visual pattern as the user detail dialog.
- [x] 3.5 Remove the requested extra summary tiles from the assign-rider dialog while preserving the remaining assignment summary and parcel list.

## 4. Shared Data and Presentation Wiring

- [x] 4.1 Ensure parcel DTOs and component props expose the rider, status, and failure-note data required by the updated edit, detail, and dialog surfaces.
- [x] 4.2 Keep role checks and parcel-status rules server-side while limiting frontend changes to presentation and allowed input wiring.

## 5. Tests

- [x] 5.1 Add or update focused tests for parcel edit submission success and validation failure handling.
- [x] 5.2 Add or update component coverage for rider/admin failure-note display behavior and rider parcel-card always-expanded rendering where feasible.
- [x] 5.3 Add or update component coverage for the settlements empty state and other UI regressions that already have practical test coverage points.

## 6. Verification

- [x] 6.1 Run lint after implementation.
- [x] 6.2 Run typecheck after implementation.
- [x] 6.3 Manually verify admin parcel edit, edit-user password reset, township details, assign rider dialog, and settlements empty-state behavior.
- [x] 6.4 Manually verify rider parcel cards, failure-note editing, rider parcel detail sheet, and `Canceled` status badge presentation.
