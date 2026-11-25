## Why

Riders can start and finish deliveries in the Expo app (slices 4 and 5), but when a delivery fails (the receiver doesn't answer, the address is wrong, the receiver refuses the parcel) they still have to open the web page to report it. Until they do, admins don't see the parcel in the `Need review` queue. And since slice 5 enforces the failure-note rule on the server, a rider who reported a failure by mistake can't mark the parcel delivered from the app without going back to the web to delete the note. This slice adds reporting, editing and deleting failure notes to the app. See `docs/mobile-app.md`; this is slice 6 of 9.

## What Changes

- **Shared operations**: move the bodies of the three web server actions (`reportDeliveryFailureForRiderParcelAction`, `updateDeliveryFailureForRiderParcelAction`, `deleteDeliveryFailureForRiderParcelAction`) into `reportRiderDeliveryFailure()`, `updateRiderDeliveryFailure()` and `deleteRiderDeliveryFailure()` in `src/features/parcels/server/rider-operations.ts`, next to slice 4's and 5's operations. The server actions become thin wrappers and keep their return shape and messages.
- **Typed DAL errors**: the three failure-note DAL functions throw `ParcelOperationError` with unchanged messages, like start delivery and mark delivered.
- **Fix**: `deleteDeliveryFailureForRiderParcel` reads the parcel without a row lock, unlike report and update. It now locks the row (`FOR UPDATE`), so a delete can't race an edit, an admin resolution or a delivery.
- **Server**: `POST`, `PATCH` and `DELETE /api/mobile/v1/rider/parcels/{parcelId}/failure-note`, with a JSON `{ note }` body for `POST` and `PATCH`. Responses follow the mobile envelope with 200, 400, 401, 403, 404, 409 and 500, and return the parcel's current active note.
- **Contract**: request and response schemas and the 500-character note limit in `src/features/mobile-api/contract.ts`.
- **App**:
  - The detail screen of an on-the-way parcel offers "Report failure". With an active note, it shows the note with "Edit note", and explains that Mark delivered comes back if the note is deleted.
  - Cards with an active failure note say "Failure reported" where "Mark delivered" would be, so the missing button is explained.
  - A Failure note screen (modal) with the parcel summary and the receiver's call link, quick reasons that fill in the note, a multiline note field with a character count, "Save", and in edit mode "Delete note" behind a confirmation.
  - `apiPatch` and `apiDelete` next to `apiPost`.
- **Docs**: roadmap status in `docs/mobile-app.md`.

## Capabilities

### New Capabilities

- `mobile-rider-delivery-failure`: report, edit and delete the active delivery failure note on an assigned on-the-way parcel, through the mobile API and in the native app.

### Modified Capabilities

- `rider-delivery-actions`: the web rider page and the mobile app share one operation per failure-note action, failure-note deletion locks the parcel like report and edit, and an unauthorized edit is rejected like a report or delete.

## Impact

- `src/features/parcels/server/rider-operations.ts` gains three operations. The three server actions in `src/features/parcels/server/actions.ts` delegate to them. The three DAL functions throw `ParcelOperationError`, and delete locks the row.
- New route `src/app/api/mobile/v1/rider/parcels/[parcelId]/failure-note/route.ts`.
- `mobile/` gains `apiPatch`, `apiDelete`, three mutation hooks, a Failure note screen, and changes to the detail screen and parcel card. No new packages.
- The web server actions now pass `riderUserId` to cache invalidation, so the rider's own tab counts refresh too. Server actions keep the `"server-action"` caller.
- No database changes: notes stay plain text in the existing JSONB history.
- Out of scope: photos attached to failure reports, a fixed reason code stored separately from the text, showing past (inactive) notes, admin resolution in the app, and returns (slice 7).
