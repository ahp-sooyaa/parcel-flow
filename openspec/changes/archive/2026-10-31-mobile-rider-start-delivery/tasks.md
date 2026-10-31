## 1. Shared operation

- [x] 1.1 Add `ParcelOperationError` (`code`: `forbidden`, `not_found`, `not_assigned`, `conflict`) in `src/features/parcels/server/errors.ts`, and throw it from the five checks in `startDeliveryForRiderParcels` with unchanged messages.
- [x] 1.2 Move `revalidateParcelOperationalPaths` from `actions.ts` to `src/lib/cache-invalidation.ts`, taking `{ caller, riderUserId? }`. Add the `expireNow` option to `revalidateParcelWriteCaches` (`{ expire: 0 }` instead of `"max"`). Update the other callers in `actions.ts` to pass `{ caller: "server-action" }`.
- [x] 1.3 Add `startRiderDelivery(actor, input, { caller })` in `src/features/parcels/server/rider-operations.ts` (no `"use server"`): validate with the moved `startDeliveryInputSchema` (now max 50), authorize, call the DAL, map errors to `reason`, and invalidate on success.
- [x] 1.4 Make `startDeliveryForRiderParcelsAction` a thin wrapper that returns `{ ok, message }` exactly as before.

## 2. Contract and route

- [x] 2.1 Add `mobileStartDeliveryRequestSchema`, `mobileStartDeliveryResultSchema` and `mobileStartDeliveryResponseSchema` to `src/features/mobile-api/contract.ts`. Keep it zod-only, with no `@/` imports.
- [x] 2.2 Add `POST src/app/api/mobile/v1/rider/parcels/start-delivery/route.ts`: `requireMobileRider()`, parse JSON (400 on failure), call `startRiderDelivery(..., { caller: "route-handler" })`, and map `invalid`/`forbidden`/`not_found`/`conflict`/`failed` to 400/403/404/409/500. `not_found` always uses "One or more selected parcels were not found.", and `failed` uses "Unable to start delivery.".

## 3. Cleanup

- [x] 3.1 Drop the `coerceSqlNumber` calls and the string-count comment from `toMobileRiderParcelPage` in `src/features/mobile-api/server/parcels.ts`.
- [x] 3.2 Change "converts the DAL's string counts" in `tests/unit/mobile-rider-parcels.unit.test.ts` to pass numbers and assert they come straight through.

## 4. Server tests

- [x] 4.1 `tests/unit/rider-operations.unit.test.ts`: `invalid` (empty, non-UUID, over 50), `forbidden`, each `ParcelOperationError` code mapped (`not_assigned` → `not_found`), plain errors → `failed`, de-duplicated IDs, and the invalidation caller and rider ID. Spread the real module exports into every `mock.module`.
- [x] 4.2 Add start-delivery cases to `tests/unit/parcel-actions.unit.test.ts`: unchanged messages for single and batch success, validation, permission and DAL errors, and `updateTag` used rather than `revalidateTag`.
- [x] 4.3 `tests/unit/mobile-rider-start-delivery.unit.test.ts`: 401, 403, 400 (non-JSON and bad bodies), 404, 409, 500 with a hidden message, a 200 body that parses with the contract, `revalidateTag` called with `{ expire: 0 }`, and the contract and server request schemas agreeing on shared fixtures.
- [x] 4.4 Unit tests for `ParcelOperationError` codes thrown by `startDeliveryForRiderParcels` (or cover them in 5.1), and for `revalidateParcelWriteCaches` with and without `expireNow`.
- [x] 4.5 Run each new test file paired with every other unit test file to catch Bun mock leaks.

## 5. Integration test

- [x] 5.1 `tests/integration/mobile-rider-start-delivery.integration.test.ts`, with `next/cache` mocked (real exports spread): rider A starts two of their own `at_office` parcels (both `on_the_way`, one pending `delivery_attempt` payout each); a batch with A's parcel and rider B's parcel is a 404 and neither changes; an `on_the_way` parcel is a 409.

## 6. App data layer

- [x] 6.1 Refactor `mobile/src/api/client.ts` into an internal `request()` used by `apiGet` (same signature) and a new `apiPost(path, body, schema)` that sends JSON. Extend `client.test.ts` for `apiPost`.
- [x] 6.2 Add `useStartDelivery()` to `mobile/src/api/parcels.ts`: a mutation posting `{ parcelIds }` that, on settle, invalidates `["rider-parcels"]` and `["rider-parcel", id]` for each ID.
- [x] 6.3 Add a `success` tone to `Notice` using the `successInk` and `successSoft` tokens.

## 7. App screens

- [x] 7.1 `ParcelCard`: optional `selection` (`checked`, `disabled`, `onToggle`) and `onStartDelivery` / `starting` props. Show a checkbox and a "Start delivery" button only for `at_office` parcels when they're passed.
- [x] 7.2 List screen (`(rider)/index.tsx`): selection state on the To deliver tab (cleared on tab switch, pruned to loaded `at_office` IDs after refetch), the bottom bar with count, total and "Clear", the `Alert.alert` confirmation for two or more, one start at a time with everything disabled while pending, and a result `Notice`.
- [x] 7.3 Detail screen (`(rider)/parcels/[parcelId].tsx`): a "Start delivery" button for `at_office` parcels, with a result `Notice`. On 404 the existing state shows after the refetch.

## 8. App tests

- [x] 8.1 List screen Jest tests: start button and checkbox only on `at_office` cards; a single start posts one ID and refetches; the bar shows count and total; two selected → confirm dialog (mock `Alert.alert`), Cancel posts nothing and Start posts both; the error notice; selection cleared on tab switch.
- [x] 8.2 Detail screen Jest tests: the button only for `at_office`, success refetches and shows the message, and 409 shows the error.

## 9. Verification and docs

- [x] 9.1 Run the root checks (`lint`, `format:check`, `typecheck`, `test:unit`, which includes the component tests, and `test:integration`) and the `mobile/` checks.
- [x] 9.2 curl against the dev server with a seeded rider: start one parcel (200), repeat it (409), send another rider's parcel ID (404), an empty list (400), and check the web rider page shows the parcel on the way.
- [x] 9.3 On the user's phone in Expo Go: start one parcel from its card and one from the detail screen, select several and confirm, cancel a confirmation, and check the web rider page and the tab counts agree. (Confirmed on the user's Android phone.)
- [x] 9.4 Update the roadmap status, and add 404 and 409 to the status code table in `docs/mobile-app.md`.
