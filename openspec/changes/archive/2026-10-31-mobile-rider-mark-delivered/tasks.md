## 1. Server: DAL and shared operation

- [x] 1.1 In the DAL's `markRiderParcelDelivered`, throw `ParcelOperationError` (`forbidden`, `not_found`, `not_assigned`, `conflict`) with unchanged messages, select `deliveryFailureNote`, and throw `conflict` "Resolve the delivery failure note before marking this parcel delivered." when a note is active.
- [x] 1.2 Add `markRiderParcelDelivered(actor, { parcelId, proofImage })` to `src/features/parcels/server/rider-operations.ts`: authorize, the demo rate limit (moved from the web route), validate (schemas moved from the web route), pre-check with `getParcelByIdForRealtimeScope`, upload (or the demo key), the DAL, delete the photo on DAL failure (logging a delete error), and invalidate with `{ caller: "route-handler" }`.
- [x] 1.3 Make `src/app/api/rider/parcels/deliver/route.ts` a thin wrapper that keeps today's bodies and status codes (401, 403, 429, 400, 500 for other failures, 200).

## 2. Contract and mobile route

- [x] 2.1 Add `MOBILE_PROOF_IMAGE_MAX_BYTES`, `mobileProofImageTypes`, `mobileMarkDeliveredResultSchema` and `mobileMarkDeliveredResponseSchema` to `src/features/mobile-api/contract.ts` (zod-only, no `@/` imports).
- [x] 2.2 Add `POST src/app/api/mobile/v1/rider/parcels/[parcelId]/deliver/route.ts`: `requireMobileRider()`, parse multipart (400), call the operation with the path's `parcelId`, and map to 400/403/404 ("Parcel not found.")/409/429/500.

## 3. Amount to collect

- [x] 3.1 Use `calculateAmountToCollect` in `src/features/mobile-api/server/parcels.ts` instead of the local `getAmountToCollect`, and add a prepaid case to its unit test.

## 4. Server tests

- [x] 4.1 Extend `tests/unit/rider-operations.unit.test.ts`: forbidden, demo rate limit, invalid photo and id, the pre-check's 404 and two conflicts without uploading, success, the demo path without upload, mapped DAL errors, photo deleted on DAL failure (and a delete failure not hiding the original error), upload failure, and immediate-expiry invalidation. Spread the real exports into every `mock.module`.
- [x] 4.2 Add `tests/unit/rider-deliver-route.unit.test.ts` for the web route's unchanged responses.
- [x] 4.3 Add `tests/unit/mobile-rider-mark-delivered.unit.test.ts`: 401, 403, 400s, 404, 409, 429, 500 with hidden details, a 200 that parses with the contract, and the contract and server photo limits being equal.
- [x] 4.4 Run each new or changed unit test file paired with every other unit and component test file to catch Bun mock leaks (in zsh, split the pair with `${=pair}`).

## 5. Integration test

- [x] 5.1 `tests/integration/mobile-rider-mark-delivered.integration.test.ts`, with the upload module mocked (real exports spread): own on-the-way COD parcel delivered with the key and collected amount; another rider's parcel → 404 with no upload; an at-office parcel → 409; an active failure note → 409 with no upload. Also call the DAL directly on a parcel with a failure note and expect a `conflict` `ParcelOperationError`.

## 6. App data layer

- [x] 6.1 `npx expo install expo-image-picker expo-image-manipulator`, and add the `expo-image-picker` plugin with a camera permission message to `app.json`.
- [x] 6.2 Add `apiPostForm(path, formData, schema)` to `mobile/src/api/client.ts` (no `Content-Type` header), with tests.
- [x] 6.3 Add `mobile/src/delivery/proof-photo.ts`: `takeProofPhoto`, `chooseProofPhoto` and `prepareProofPhoto` (long edge ≤ 1600 px, JPEG 0.7, no EXIF). Check the installed manipulator API's types before writing it.
- [x] 6.4 Add `useMarkDelivered()` to `mobile/src/api/parcels.ts`, invalidating the lists and that parcel's detail on settle.

## 7. App screens

- [x] 7.1 `ParcelCard`: a `markDelivered` prop rendering "Mark delivered", passed by the list for on-the-way parcels without an active failure note.
- [x] 7.2 Detail screen: "Mark delivered" under the same rule.
- [x] 7.3 Add `mobile/src/app/(rider)/deliver/[parcelId].tsx` as a modal: parcel summary and amount to collect, "Take photo" and "Choose from gallery", the permission-denied state with "Open settings", the preview with "Retake", "Confirm delivered" (disabled without a photo, busy while uploading, no swipe-to-dismiss), the success state with "Done", errors that keep the photo, and the not-eligible state.

## 8. App tests

- [x] 8.1 List and detail Jest tests: "Mark delivered" only for on-the-way parcels without a failure note, and it navigates to the Mark delivered screen.
- [x] 8.2 Mark delivered screen tests, with the picker and manipulator mocked: confirm disabled without a photo, take, preview and retake, permission denied, gallery, the posted `FormData` part, success and "Done", a 409 keeping the photo, and the not-eligible state.

## 9. Verification and docs

- [x] 9.1 Run the root checks (`lint`, `format:check`, `typecheck`, `test:unit`, `test:integration`) and the `mobile/` checks.
- [x] 9.2 curl against the `test-db` dev server with the seeded e2e rider: deliver an on-the-way parcel with a small JPEG (200), repeat it (409), another rider's or a random parcel (404), no photo (400), and a parcel with a failure note (409). If `.env.test` has no working R2 credentials, use the `demo-local` server for the success path. (Ran against the `test-db` server; `.env.test` R2 credentials worked, so the success path uploaded a real photo.)
- [x] 9.3 On the user's phone in Expo Go: deliver from a card and from the detail screen with the camera, once from the gallery, deny then allow camera permission, check the photo size in R2 is small, and check the web rider page and tab counts agree. (The first try found Expo's `fetch` rejecting React Native's `{ uri, name, type }` part; fixed with `proofPhotoUploadPart`, then everything passed.)
- [x] 9.4 Update the roadmap status in `docs/mobile-app.md`.
