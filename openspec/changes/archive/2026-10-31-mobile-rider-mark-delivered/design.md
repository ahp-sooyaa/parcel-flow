## Context

Overall context and roadmap: `docs/mobile-app.md`. This is slice 5 of 9. Slice 4 set up the shared rider operation layer (`src/features/parcels/server/rider-operations.ts`), `ParcelOperationError`, and the route-safe cache invalidation this slice reuses.

What already exists:

- **Web route** `POST /api/rider/parcels/deliver` (`src/app/api/rider/parcels/deliver/route.ts`), called by the web rider card's Mark Delivered dialog with `fetch` and `FormData`. The web reads only the JSON body (`deliveryUploadResponseSchema`), never the status code. The route:
  1. `requireCurrentUser()`; a thrown error → 401.
  2. Non-rider, or not allowed `on_the_way → delivered` → 403 "You do not have permission to mark parcels delivered.".
  3. In demo mode, a per-user limiter (30 a minute) → 429.
  4. Parses multipart (400 if not multipart) and validates `parcelId` (UUID) and `proofImage` (required, ≤ 5 MB, JPG/PNG/WebP) → 400. In demo mode the photo is ignored.
  5. Uploads to R2 with `uploadDeliveryProofImage`, or in demo mode picks `pickDemoProofImageKey(parcelId)`.
  6. Calls the DAL. Any error → 500 with the error's message.
  7. `revalidateParcelWriteCaches({ riderUserId })` with `"max"`, plus three `revalidatePath` calls.
- **Two gaps in that route**:
  - The upload happens **before** the DAL's ownership and status checks. Any rider can store a photo under any parcel's R2 prefix, and a rejected delivery leaves the photo behind. Nothing deletes it; the admin correction action does clean up after a rejected write (`deleteDeliveryProofImage`).
  - `"max"` serves stale data on the next read, so the web's `router.refresh()` right after a delivery can still show the parcel as on the way.
- **DAL** `markRiderParcelDelivered({ parcelId, proofImageKey, riderUserId, actorRole, createdBy })`:
  - Locks the parcel `FOR UPDATE` and checks, in order: permission, active rider ("Active rider profile was not found."), parcel exists ("Parcel was not found."), assigned to this rider ("You can only mark parcels assigned to your rider account delivered."), `on_the_way` ("Only on-the-way parcels can be marked delivered.").
  - The update is guarded by rider and status. It sets the delivered and collection fields: `collectedAmount = codAmount + deliveryFee` for COD, `deliveryFee` for prepaid. It stores `proofOfDeliveryImagesKeys: [key]`, writes the status log and recomputes payouts.
  - It does **not** check failure notes, although `openspec/specs/rider-delivery-actions` and the web card both treat an active failure note as blocking delivery.
- **Upload**: `uploadDeliveryProofImage({ parcelId, file })` puts `parcels/{id}/proof-of-delivery/{uuid}.{ext}` in R2 and returns the key. `deleteDeliveryProofImage(key)` removes one.
- **Mobile**: slice 3's list and detail, slice 4's `apiPost`, `useStartDelivery`, card `startDelivery` prop and result `Notice`. The list DTO's `hasActiveFailureNote` exists for exactly this. No camera or image packages are installed.

## Goals / Non-Goals

**Goals:**

- One delivery rule set for the web and the app, including the failure-note rule, now enforced on the server.
- No photo stored for a request that was always going to be rejected, and none left behind when the write fails.
- A fast, forgiving capture flow on a phone: camera first, preview, a small upload, and a clear amount to collect.

**Non-Goals:**

- Several photos per delivery, background or offline upload retries.
- Showing proof photos in the app.
- Failure notes and returns (slices 6 and 7).

## Decisions

### Shared operation

In `src/features/parcels/server/rider-operations.ts`:

```ts
export async function markRiderParcelDelivered(
  actor: CurrentUser,
  input: { parcelId: unknown; proofImage: unknown },
): Promise<MarkRiderParcelDeliveredResult>;

type MarkRiderParcelDeliveredResult =
  | { ok: true; message: "Parcel marked delivered."; parcelId: string }
  | { ok: false; reason: RiderOperationFailureReason | "rate_limited"; message: string };
```

The name matches the DAL function, so the module imports the DAL one under an alias. Both callers are route handlers, so there's no `caller` option: invalidation always uses `"route-handler"` (immediate expiry).

1. **Authorize**: rider and allowed `on_the_way → delivered` → otherwise `forbidden`, with the message as today.
2. **Demo rate limit**: the 30-a-minute limiter moves here from the web route, so both routes share one per-user budget → `rate_limited`.
3. **Validate**: the `markDeliveredInputSchema` and demo variant move here unchanged → `invalid`.
4. **Pre-check** (new): `getParcelByIdForRealtimeScope(parcelId, { role: "rider", userId })`. This is an uncached read.
   - `null` → `not_found`
   - not `on_the_way` → `conflict` "Only on-the-way parcels can be marked delivered."
   - an active failure note → `conflict` "Resolve the delivery failure note before marking this parcel delivered."

   This stops photos being stored for requests that are bound to fail. The DAL still re-checks everything under its row lock, so the pre-check is only an optimisation, not the guard.

5. **Upload**: `uploadDeliveryProofImage` (or the demo key). An upload error → `failed` "Couldn't save the delivery photo. Try again.".
6. **DAL**: `ParcelOperationError` → its reason (`not_assigned` → `not_found`); other errors → `failed`. On any DAL failure after a real upload, call `deleteDeliveryProofImage(key)`. Its own error is caught and logged, and the original failure is returned.
7. **Invalidate**: `revalidateParcelOperationalPaths({ caller: "route-handler", riderUserId })`.

Validation before the permission check is the web route's current order reversed. Rejecting a non-rider first, before reading their upload, is what slice 4's route does too, and it doesn't change any message.

### Typed DAL errors and the failure-note rule

`markRiderParcelDelivered` in the DAL throws `ParcelOperationError` for its checks, with unchanged messages:

| Check                                   | Code           |
| --------------------------------------- | -------------- |
| permission, inactive rider              | `forbidden`    |
| missing parcel                          | `not_found`    |
| another rider's parcel                  | `not_assigned` |
| not `on_the_way`, guarded update missed | `conflict`     |

It also selects `deliveryFailureNote` and, after the status check, throws `conflict` "Resolve the delivery failure note before marking this parcel delivered." when `getActiveParcelFailureNote(parseParcelFailureNotes(...))` is set. This is the same helper pair the DTO mapping uses. Enforcing it in the DAL, not only the operation's pre-check, closes the race where a note is reported between the pre-check and the write.

### Web route

`src/app/api/rider/parcels/deliver/route.ts` keeps its contract, because the web reads its JSON:

- 401 when `requireCurrentUser()` throws, as now.
- Parses multipart (400 as now), then calls the operation with the form fields.
- It maps `forbidden` → 403, `rate_limited` → 429 and `invalid` → 400, as today. Every other failure → 500 with the operation's message, which is today's status and message for DAL errors.

The only behaviour changes on the web are deliberate and invisible in normal use:

- no orphaned photo
- the failure-note rule (the web never offers delivery then anyway)
- the clearer upload-failure message
- immediate cache expiry

### Mobile endpoint

```text
POST /api/mobile/v1/rider/parcels/{parcelId}/deliver
Content-Type: multipart/form-data
proofImage: <file>
```

The parcel ID is in the path, like the slice 3 detail endpoint, and the file is the only form field.

| Result                                                        | Status    | Message                                                                          |
| ------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| Delivered                                                     | 200       | "Parcel marked delivered.", `data: { parcelId }`                                 |
| Not multipart, bad UUID, photo missing, too big or wrong type | 400       | the validation message                                                           |
| No session / inactive or not a rider                          | 401 / 403 | from `requireMobileRider()`                                                      |
| `not_found` (missing or another rider's)                      | 404       | "Parcel not found." (same as the detail endpoint)                                |
| `conflict` (not on the way, or failure note)                  | 409       | the operation's message                                                          |
| `rate_limited` (demo only)                                    | 429       | "Too many requests. Try again in a minute."                                      |
| `failed`                                                      | 500       | "Unable to mark parcel delivered." (and the photo message for an upload failure) |

The route reads `request.formData()`. The app's `fetch` (Expo's, which replaces React Native's in SDK 58) sends the photo part as a normal multipart file, which Next.js parses into a `File`. Route handlers have no body-size limit of their own (`serverActions.bodySizeLimit` only applies to Server Actions), so the 5 MB check in the schema is the limit, as on the web.

### Contract

```ts
export const MOBILE_PROOF_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const mobileProofImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
mobileMarkDeliveredResultSchema = z.object({ parcelId: z.string() });
mobileMarkDeliveredResponseSchema = mobileSuccessResponseSchema(mobileMarkDeliveredResultSchema);
```

The operation's schema uses its own constants. A unit test asserts they equal the contract's, as slice 3 does for the status enums.

### App: capture and compression

New dependencies via `npx expo install expo-image-picker expo-image-manipulator`, so their versions match SDK 58. Both work in Expo Go. Add the `expo-image-picker` config plugin with a camera permission message for later development and EAS builds; Expo Go ignores it.

`mobile/src/delivery/proof-photo.ts`:

- `takeProofPhoto()`:
  - Requests camera permission; if denied, returns `{ status: "denied" }`.
  - Otherwise calls `launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false })`, then `prepareProofPhoto`.
- `chooseProofPhoto()`: `launchImageLibraryAsync` with the same options. Android's system photo picker needs no permission.
- `prepareProofPhoto(asset)`:
  - Resizes so the long edge is at most 1600 px, never upscaling.
  - Saves as JPEG at `compress: 0.7` and returns `{ uri, width, height }`.
  - The output carries no EXIF, so no location.
  - At implementation time, check the installed package's types for the current manipulator API (the contextual `ImageManipulator.manipulate(uri).resize(...).renderAsync()` then `saveAsync(...)`) rather than the deprecated `manipulateAsync`.

1600 px keeps a label or a doorway readable when an admin zooms in. A 12 MP phone photo of 3 to 6 MB becomes roughly 150 to 400 KB, about ten times less mobile data, and always well under the 5 MB limit.

### App: data layer

- `apiPostForm(path, formData, schema)` shares slice 4's internal `request()`. It must **not** set `Content-Type`, so `fetch` adds the multipart boundary itself.
- `useMarkDelivered()` builds the `FormData`: `proofImage` is `proofPhotoUploadPart(photo)`, `{ name: "proof.jpg", type: "image/jpeg", bytes() }`, which reads the saved photo through `expo-file-system`'s `File`. Expo's `fetch` rejects React Native's `{ uri, name, type }` part before sending anything (found on the phone), but it encodes any part with `bytes()` as a file. It's a `useMutation` that, on settle, invalidates `["rider-parcels"]` and `["rider-parcel", id]`, like `useStartDelivery`.

### App: screens

- **Entry points** (decided with the user: card and detail): a "Mark delivered" button on on-the-way cards whose `hasActiveFailureNote` is false, and on the detail screen under the same rule. On a card it sits where "Start delivery" sits for at-office parcels; the two never show together. Both push `/deliver/[parcelId]`.
- **Mark delivered screen** (`mobile/src/app/(rider)/deliver/[parcelId].tsx`, presented as a modal in the Stack):
  - Shows the parcel code, receiver name and address, and a prominent "Collect 28,000 MMK". It reuses `useRiderParcel(parcelId)` and its cached preview, so it opens instantly.
  - **Photo** (decided with the user: camera with a gallery fallback): a primary "Take photo" button and a smaller "Choose from gallery" link.
    - If camera permission is denied, it shows a notice with "Open settings" (`Linking.openSettings()`), and the gallery link stays available.
    - After a photo is picked, an `Image` preview with "Retake" replaces the buttons. Compression runs right after capture with a short spinner, so confirming isn't delayed.
  - **Confirm**: "Confirm delivered" stays disabled until there's a photo. While uploading it's busy, and the screen can't be swiped closed (`gestureEnabled: false`) so the request isn't abandoned half way.
  - **Success**: the screen shows "Parcel marked delivered." with a "Done" button that returns to the previous screen. That screen has refetched by then, so the parcel shows in the Delivered tab, or as Delivered on its detail screen. A success state on this screen is simpler and clearer than passing a message back through the router.
  - **Errors**: the message shows in a `Notice` and the photo is kept, so "Confirm delivered" can be retried without retaking it. A 404 or 409 also refetches (the mutation's settle), and the screen then shows the parcel's current state: no longer assigned, already delivered, or has a failure note, with a way back.
  - If the parcel isn't on the way, or has an active failure note, when the screen opens (for example from a stale card), it shows why and offers no photo controls.

### Amount to collect

`getAmountToCollect` in `src/features/mobile-api/server/parcels.ts` becomes `calculateAmountToCollect` from `src/features/parcels/server/utils.ts`. That helper returns COD plus the fee for COD parcels and the fee only for prepaid ones, matching the DAL's `collectedAmount`. Prepaid parcels are created with `codAmount: 0`, so values only change if a prepaid parcel ever carries a COD amount. Its slice 3 unit test gains a prepaid case.

### Idempotency and concurrency

- **Double tap**: the button is busy while the request runs, and the DAL's row lock and guarded update reject a second write with 409.
- **Lost response, then retry**: the retry's pre-check sees `delivered`, returns 409 without uploading again, and the screen's refetch shows the parcel delivered. No duplicate photo and no second write.
- **A failure note added between the pre-check and the write**: the DAL check under the lock rejects it, and the operation deletes the just-uploaded photo.
- **Admin reassignment mid-upload**: the DAL returns `not_found`, and the photo is deleted.

### Tests

- **Operation unit** (`tests/unit/rider-operations.unit.test.ts`, extended):
  - `forbidden`, `rate_limited` in demo mode, `invalid` (missing, too big, wrong type, bad UUID)
  - the pre-check's `not_found` and the two `conflict`s, each without calling the upload
  - upload then DAL success, and the demo path never uploading
  - the DAL errors mapped, the photo deleted when the DAL fails, a delete failure not masking the original error
  - an upload failure → `failed` with the photo message
  - immediate-expiry invalidation

  The DAL, upload, `next/cache` and demo mocks spread the real exports.

- **Web route unit** (`tests/unit/rider-deliver-route.unit.test.ts`, new; the route has none today): 401, 403, 429, 400 for non-multipart and a missing photo, a 500 with the DAL message, and the 200 body.
- **Mobile route unit** (`tests/unit/mobile-rider-mark-delivered.unit.test.ts`): 401, 403, 400s, 404, 409, 429, 500 with hidden details, a 200 that parses with the contract, and the contract and server photo limits being equal.
- **Mapper unit**: a prepaid parcel's `amountToCollect` is the fee only.
- **Integration** (`tests/integration/mobile-rider-mark-delivered.integration.test.ts`), with the upload module mocked (real exports spread) to return a fixed key:
  - Rider A's on-the-way COD parcel becomes `delivered`, with the key stored and `collectedAmount` = COD + fee.
  - Rider B's parcel → 404, unchanged and no upload.
  - An at-office parcel → 409.
  - A parcel with an active failure note → 409, with no upload and no change.
  - Separately, the DAL called directly on a parcel with a failure note throws `conflict`.
- **App Jest**:
  - `apiPostForm`: no `Content-Type` header, the session cookie, and the envelope.
  - The card: "Mark delivered" only for on-the-way parcels without a failure note.
  - The detail: the same rule.
  - The Mark delivered screen, with `expo-image-picker` and `expo-image-manipulator` mocked:
    - confirm disabled without a photo
    - take photo, preview, retake
    - permission denied → settings link and gallery still offered
    - the posted `FormData` part
    - the success state and "Done"
    - a 409 shown with the photo kept
    - a parcel that isn't on the way showing no photo controls

## Risks / Trade-offs

- [The pre-check adds a read] One extra uncached query per delivery → small next to the upload, and it saves R2 writes and orphan cleanup.
- [Deleting the photo can itself fail] An R2 hiccup could still leave an orphan → it's logged; a sweep of unreferenced keys could come later if it shows up.
- [The new failure-note rule could block a rider] A rider who reported a failure but then delivers must first remove the note → the web already works this way, and slice 6 brings note editing and deletion to the app.
- [Compression quality] 1600 px and JPEG 0.7 could blur fine print on a label → still well above what admins need to confirm a hand-off; it's one constant to tune.
- [Expo Go only] The camera permission text in `app.json` only matters for development and EAS builds (slice 9) → nothing else needs it now.
- [Large upload on a weak connection] No resumable upload → the photo is kept on failure so the rider can retry; the offline queue is in "Later Ideas".

## Migration Plan

No database changes. The web route keeps its contract, and the mobile route and screens are additive. Rollback is reverting the change. Parcels delivered in the meantime stay delivered, with their photos in R2 as before.
