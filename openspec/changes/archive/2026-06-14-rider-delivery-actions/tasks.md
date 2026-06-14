## 1. Schema and Storage

- [x] 1.1 Add `deliveryFailureNote` to the Drizzle parcel schema as nullable text mapped to `delivery_failure_note`.
- [x] 1.2 Generate or add the database migration for `parcels.delivery_failure_note`.
- [x] 1.3 Confirm `proofOfDeliveryImagesKeys` remains available as the delivery proof key array in schema, DTOs, and migrations.
- [x] 1.4 Add feature-local upload utility support for proof-of-delivery images using the documented R2 object key format.
- [x] 1.5 Validate delivery proof file type and size on the server before storing or persisting image keys.

## 2. Server Actions and DAL

- [x] 2.1 Add Zod validation schemas for rider failure reporting and rider mark-delivered requests.
- [x] 2.2 Implement a rider-scoped DAL mutation to report delivery failure for one assigned `on_the_way` parcel.
- [x] 2.3 Ensure failure reporting writes only `delivery_failure_note` and does not alter parcel status, collection fields, timestamps, rider assignment, or financial items.
- [x] 2.4 Implement a rider-scoped DAL mutation to mark one assigned `on_the_way` parcel delivered.
- [x] 2.5 Ensure mark-delivered updates parcel status, timestamps, collection fields, payment statuses, office receipt state, settlement status, payout status, and proof image keys.
- [x] 2.6 Generate pending `cod_remit` and `rider_way_payout` financial items for delivered COD parcels in the same transaction as the parcel update.
- [x] 2.7 Generate only the pending `rider_way_payout` financial item for delivered non-COD parcels in the same transaction as the parcel update.
- [x] 2.8 Reject non-rider actors, inactive riders, unrelated parcels, missing parcels, and parcels whose status is not `on_the_way` for both new actions.
- [x] 2.9 Add path revalidation for dashboard parcel views after successful report-failure and mark-delivered actions.

## 3. Rider Card UI

- [x] 3.1 Wire the existing `Report Failure` button to open a shadcn dialog from the rider card list.
- [x] 3.2 Add the failure note textarea, validation messaging, pending state, cancel behavior, and success/error feedback.
- [x] 3.3 Wire the existing `Mark Delivered` button to open a shadcn dialog from the rider card list.
- [x] 3.4 Display the parcel collection amount in the mark-delivered dialog using the same calculation shown on the card.
- [x] 3.5 Add a proof photo input with `accept="image/*"` and camera-oriented capture behavior for compatible mobile browsers.
- [x] 3.6 Show an automatic image preview after the rider captures or selects a proof photo.
- [x] 3.7 Submit mark-delivered data as multipart form data to the server action and disable duplicate submissions while pending.
- [x] 3.8 Close dialogs and refresh visible rider parcel state after successful actions.
- [x] 3.9 Hide `Report Failure` and `Mark Delivered` on `on_the_way` parcels that already have a failure note.
- [x] 3.10 Show a failure-note management button for `on_the_way` parcels that already have a failure note.
- [x] 3.11 Allow riders to view, edit, and delete the existing failure note from a shadcn dialog.

## 4. DTOs and Display State

- [x] 4.1 Include `deliveryFailureNote` and proof delivery image keys in parcel DTOs where rider cards or detail sheets need them.
- [x] 4.2 Ensure delivered parcels move from the `To Deliver` tab to the `Delivered` tab after revalidation.
- [x] 4.3 Ensure failed-report parcels remain in the `To Deliver` tab as `on_the_way`.
- [x] 4.4 Preserve existing card expansion, selection, filter, pagination, and detail sheet behavior after adding dialogs.
- [x] 4.5 Ensure deleting a failure note restores the normal `Report Failure` and `Mark Delivered` actions after refresh.

## 5. Tests

- [x] 5.1 Add unit or integration coverage for successful failure reporting.
- [x] 5.2 Add unit or integration coverage that failure reporting rejects invalid role, inactive rider, unrelated parcel, missing parcel, and non-`on_the_way` parcel cases.
- [x] 5.3 Add unit or integration coverage for successful COD mark-delivered parcel updates and financial item creation.
- [x] 5.4 Add unit or integration coverage for successful non-COD mark-delivered parcel updates and financial item creation.
- [x] 5.5 Add unit or integration coverage that mark-delivered rejects missing proof, invalid proof, invalid role, inactive rider, unrelated parcel, missing parcel, and non-`on_the_way` parcel cases.
- [x] 5.6 Add component coverage for opening both dialogs, required inputs, proof preview behavior, and submit pending states where feasible.
- [x] 5.7 Add unit or integration coverage for deleting a failure note.
- [x] 5.8 Add component coverage for existing failure note view, edit, delete, and action suppression behavior.

## 6. Verification

- [x] 6.1 Run lint after implementation.
- [x] 6.2 Run typecheck after implementation.
- [x] 6.3 Run relevant unit, component, or integration tests for parcel delivery actions.
- [x] 6.4 Manually verify the rider parcel card flow on desktop for failure reporting, delivery proof upload, delivery completion, tabs, filters, and detail sheet behavior.
- [x] 6.5 Manually verify the rider parcel card flow on mobile width, including camera-first proof capture behavior where the environment supports it.
