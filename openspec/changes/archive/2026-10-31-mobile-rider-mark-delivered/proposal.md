## Why

Riders can start deliveries in the Expo app (slice 4), but they still finish them on the web page, taking the proof photo through a browser file input. Marking a parcel delivered is the action riders repeat most during the day, and a native camera flow with a smaller upload is the main reason for the app. This slice adds it. See `docs/mobile-app.md`; this is slice 5 of 9.

## What Changes

- **Shared operation**: move the body of `POST /api/rider/parcels/deliver` (validate the photo → permission check → upload to R2 → `markRiderParcelDelivered` DAL → cache invalidation) into `markRiderParcelDelivered()` in `src/features/parcels/server/rider-operations.ts`, next to slice 4's `startRiderDelivery()`. The web route becomes a thin wrapper and keeps its response bodies and status codes.
  - It checks the parcel is the rider's and on the way **before** uploading, so a bad request no longer stores a photo in R2.
  - If the DAL rejects the delivery after the upload, it deletes the uploaded photo instead of leaving it behind.
  - The demo-mode rate limit and sample photo move with it, so the web and the app share them.
- **Typed DAL errors**: `markRiderParcelDelivered` throws `ParcelOperationError` with unchanged messages, like slice 4's start delivery.
- **New server rule**: delivery is rejected while the parcel has an active failure note. The web already hides Mark Delivered in that case (decided with the user to enforce it on the server too).
- **Server**: `POST /api/mobile/v1/rider/parcels/{parcelId}/deliver`, `multipart/form-data` with `proofImage`. 200, 400, 401, 403, 404, 409, 429 and 500 follow the mobile envelope.
- **Contract**: the response schema and the shared photo limits (5 MB, JPG/PNG/WebP) in `src/features/mobile-api/contract.ts`.
- **App**:
  - "Mark delivered" on each on-the-way card without an active failure note, and on the detail screen. Both open a Mark delivered screen.
  - That screen shows the amount to collect, takes a photo with the camera (with a "Choose from gallery" fallback), shows a preview with "Retake", and confirms.
  - The photo is resized to at most 1600 px on its long edge and saved as JPEG at 0.7 quality before upload. That's typically a few hundred KB instead of several MB on mobile data, and it drops the photo's location metadata.
  - `apiPostForm` next to `apiPost` sends multipart data.
- **Cleanup**: the mobile mapper's `amountToCollect` uses the existing `calculateAmountToCollect` (fee only for prepaid parcels), so the app shows what the DAL records as collected.
- **Docs**: roadmap status in `docs/mobile-app.md`.

## Capabilities

### New Capabilities

- `mobile-rider-mark-delivered`: mark an assigned on-the-way parcel delivered with a proof photo, through the mobile API and in the native app.

### Modified Capabilities

- `rider-delivery-actions`: delivery is rejected on the server while a failure note is active, ineligible requests are rejected before the photo is stored, a photo is removed if the delivery then fails, and the web and the app share one operation.

## Impact

- `src/features/parcels/server/rider-operations.ts` gains `markRiderParcelDelivered()`. `src/app/api/rider/parcels/deliver/route.ts` delegates to it. The DAL's `markRiderParcelDelivered` throws `ParcelOperationError` and checks for an active failure note.
- New route `src/app/api/mobile/v1/rider/parcels/[parcelId]/deliver/route.ts`.
- `mobile/` gains `expo-image-picker` and `expo-image-manipulator` (both in Expo Go), `apiPostForm`, a `useMarkDelivered` mutation, a Mark delivered screen, and a button on the card and detail screen.
- The web route now expires caches immediately (`{ expire: 0 }`) instead of `"max"`, through the shared operation. The web rider page's refresh after a delivery then shows fresh data.
- No database changes.
- Out of scope: several proof photos per parcel, retrying an upload in the background or offline, failure notes (slice 6), returns (slice 7), and showing existing proof photos in the app.
