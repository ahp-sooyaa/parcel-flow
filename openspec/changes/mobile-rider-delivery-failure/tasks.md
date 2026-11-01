## 1. Server: DAL and shared operations

- [x] 1.1 In the DAL's `reportDeliveryFailureForRiderParcel`, `updateDeliveryFailureForRiderParcel` and `deleteDeliveryFailureForRiderParcel`, throw `ParcelOperationError` (`forbidden`, `not_found`, `not_assigned`, `conflict`) with unchanged messages, and add `.for("update")` to the delete's parcel read.
- [x] 1.2 Move the three input schemas from `actions.ts` to `src/features/parcels/server/rider-operations.ts` (export the note schema as `failureNoteSchema`), and add `reportRiderDeliveryFailure`, `updateRiderDeliveryFailure` and `deleteRiderDeliveryFailure(actor, input, { caller })`: validate, reject non-riders with today's messages, call the DAL, map errors with `toFailure()`, invalidate with `riderUserId`, and return `{ parcelId, activeFailureNote }`.
- [x] 1.3 Make the three server actions thin wrappers (`normalizeFormInput`, `{ caller: "server-action" }`) that keep their `{ ok, message }` results.

## 2. Contract and mobile route

- [x] 2.1 Add `MOBILE_FAILURE_NOTE_MAX_LENGTH`, `mobileFailureNoteRequestSchema`, `mobileFailureNoteResultSchema` and `mobileFailureNoteResponseSchema` to `src/features/mobile-api/contract.ts` (zod-only, no `@/` imports).
- [x] 2.2 Add `src/app/api/mobile/v1/rider/parcels/[parcelId]/failure-note/route.ts` with `POST`, `PATCH` and `DELETE`: `requireMobileRider()`, parse JSON for `POST`/`PATCH` (400), call the operation with the path's `parcelId` and the body's `note`, and map to 400/403/404 ("Parcel not found.")/409/500 ("Unable to save the failure note.").

## 3. Server tests

- [x] 3.1 Extend `tests/unit/rider-operations.unit.test.ts` for each operation: invalid id and note (empty, 501 characters), forbidden, success with the returned note and invalidation (caller and `riderUserId`), mapped `ParcelOperationError` codes, and other errors → `failed`. Spread the real exports into every `mock.module`.
- [x] 3.2 Adjust the failure tests in `tests/unit/parcel-actions.unit.test.ts` to the wrappers, keeping their expected messages.
- [x] 3.3 Add `tests/unit/mobile-rider-delivery-failure.unit.test.ts`: per verb 401, 403, 400s, 404, 409, 500 with hidden details, a 200 that parses with the contract, the path winning over a body `parcelId`, and the contract's note limit equal to `TEXT_LIMITS.note`.
- [x] 3.4 Run each new or changed unit test file paired with every other unit and component test file to catch Bun mock leaks (in zsh, split the pair with `${=pair}`).

## 4. Integration test

- [x] 4.1 `tests/integration/mobile-rider-delivery-failure.integration.test.ts`: report (trimmed active entry, status, assignment and payouts unchanged), a second report → 409, edit, delete (inactive history kept) and then deliver succeeding through the operation with the upload mocked (real exports spread), another rider's parcel → 404 for all verbs, an at-office parcel → 409, `PATCH`/`DELETE` without a note → 409, and the DAL's `ParcelOperationError` codes.

## 5. App data layer

- [x] 5.1 Widen `request()` in `mobile/src/api/client.ts` to `POST | PATCH | DELETE` with an optional body, and add `apiPatch` and `apiDelete` (no body or `Content-Type` for delete), with tests.
- [x] 5.2 Add `useReportFailure`, `useUpdateFailureNote` and `useDeleteFailureNote(parcelId)` to `mobile/src/api/parcels.ts`: write the returned note into the cached detail on success, and invalidate the lists and that parcel's detail on settle.

## 6. App screens

- [x] 6.1 `ParcelCard`: a "Failure reported" warning line for on-the-way parcels with an active note, passed by the list where it would otherwise pass `onMarkDelivered`.
- [x] 6.2 Detail screen: "Report failure" (secondary) for on-the-way parcels without a note; with one, a "Failure reported" section with the note, the explanation line and "Edit note".
- [x] 6.3 Add `mobile/src/app/(rider)/failure/[parcelId].tsx` as a modal in the rider Stack: parcel summary with the call link, quick reasons, the multiline note with a count and `maxLength`, save disabled when empty or unchanged, busy with no swipe-to-dismiss, "Delete note" behind `Alert.alert`, close on success, errors that keep the text, the not-eligible state, and the switch to edit mode when a note already exists. Set the header title per mode.

## 7. App tests

- [x] 7.1 List and detail Jest tests: "Failure reported" on the card, "Report failure" and "Edit note" under the right rules, and both navigating to the Failure note screen.
- [x] 7.2 Failure note screen tests: save disabled states, quick reasons fill and append, the count, the posted trimmed note, `PATCH` on edit, delete through a mocked `Alert.alert` (confirm and cancel), closing on success, a 409 keeping the text, the not-eligible state, and the switch to edit mode.

## 8. Verification and docs

- [x] 8.1 Run the root checks (`lint`, `format:check`, `typecheck`, `test:unit`, `test:integration`) and the `mobile/` checks.
- [x] 8.2 curl against the `test-db` dev server with the seeded e2e rider: report (200), report again (409), edit (200), empty note (400), delete (200), delete again (409), another rider's or a random parcel (404), and an at-office parcel (409).
- [x] 8.3 On the user's phone in Expo Go: report with a quick reason and edited text, check the card and detail, check the web rider page and the admin `Need review` tab show it, edit, delete, then mark the parcel delivered. (The first try found the keyboard covering the note field on Android; fixed in `Screen` for every screen.)
- [ ] 8.4 Update the roadmap status in `docs/mobile-app.md`.
