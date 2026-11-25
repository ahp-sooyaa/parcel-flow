## 1. Server: DAL and shared operation

- [x] 1.1 In the DAL's `markRiderParcelReturnedToMerchant`, throw `ParcelOperationError` (`forbidden`, `not_found`, `not_assigned`, `conflict`) with unchanged messages.
- [x] 1.2 Add `getMerchantReturnContact(merchantId)` to the parcels DAL: `merchants.address` and the merchant user's `phone_number` (left join, `null` without a user).
- [x] 1.3 Add `returnRiderParcelToMerchant(actor, input, { caller })` to `src/features/parcels/server/rider-operations.ts`: validate, authorize with today's message, call the DAL, map with `toFailure()`, invalidate with `riderUserId`, return `{ parcelId }`.
- [x] 1.4 Make `markRiderParcelReturnedToMerchantAction` a thin wrapper (`normalizeFormInput`, `{ caller: "server-action" }`) that keeps its `{ ok, message }` results.

## 2. Contract and mobile routes

- [x] 2.1 In `src/features/mobile-api/contract.ts`: add `merchantName` to the list item, `merchantReturnContact` (`{ address, phoneNumber: string | null } | null`) to the detail, and `mobileReturnToMerchantResultSchema` / `mobileReturnToMerchantResponseSchema`.
- [x] 2.2 Map `merchantName` in `toMobileRiderParcelListItem`, and give `toMobileRiderParcelDetail` the contact as an argument.
- [x] 2.3 In the detail route, call `getMerchantReturnContact` only for `canceled_returned` parcels.
- [x] 2.4 Add `POST src/app/api/mobile/v1/rider/parcels/[parcelId]/return/route.ts`: `requireMobileRider()`, call the operation with the path's `parcelId`, map to 400/403/404 ("Parcel not found.")/409/500 ("Unable to complete parcel return.").

## 3. Server tests

- [x] 3.1 Extend `tests/unit/rider-operations.unit.test.ts` for `returnRiderParcelToMerchant`: invalid id, forbidden, success with invalidation (caller and `riderUserId`), mapped DAL codes, other errors → `failed`. Spread the real exports into every `mock.module`.
- [x] 3.2 Keep the return test in `tests/unit/parcel-actions.unit.test.ts` passing with its messages.
- [x] 3.3 Add `tests/unit/mobile-rider-return-to-merchant.unit.test.ts` using `mockMobileRouteSession`: 401, 403, 400, 404, 409, 500 with hidden details, and a 200 that parses with the contract.
- [x] 3.4 Extend `tests/unit/mobile-rider-parcels.unit.test.ts`: `merchantName` on list items, `merchantReturnContact` for a return, and `null` without the contact read for other statuses.
- [x] 3.5 Run each new or changed unit test file paired with every other unit and component test file to catch Bun mock leaks (in zsh, split the pair with `${=pair}`).

## 4. Integration test

- [x] 4.1 `tests/integration/mobile-rider-return-to-merchant.integration.test.ts` using `mockMobileRiderSession`, `seedTwoRiders` and `useMobileRiderTestDb`: return (status, `returnedToMerchantAt`, the deduction and `merchant_return` way items), a second request → 409 with no extra items, another rider's parcel → 404, an on-the-way parcel → 409, the return detail's contact and an on-the-way detail's `null`, and the DAL's `ParcelOperationError` codes.

## 5. App

- [x] 5.1 Add `useReturnToMerchant(parcelId)` to `mobile/src/api/parcels.ts`, invalidating the lists and that parcel's detail on settle.
- [x] 5.2 Add `confirmReturn(parcel, onConfirm)` in `mobile/src/delivery/return-to-merchant.ts`.
- [x] 5.3 `ParcelCard`: for returns, a "Return to" footer with the merchant name, and a `markReturned` prop rendering "Mark returned" (busy state).
- [x] 5.4 List screen: move per-card action props into a `cardActions(item)` helper, pass `markReturned` for `canceled_returned` cards, and show the return result in the existing notice.
- [x] 5.5 Detail screen: for returns, the "Return to merchant" section (name, address, phone link when known, "Mark returned"), no collection section, and the result or error notice.

## 6. App tests

- [x] 6.1 List tests: a return card shows "Return to" and the merchant, no amount, and "Mark returned"; confirm posts and shows the notice; cancel sends nothing; other statuses have no button.
- [x] 6.2 Detail tests: the return section with address and phone link, no collection section, a hidden missing phone, confirm and success, a 409 message, and no return section for other statuses.

## 7. Verification and docs

- [x] 7.1 Run the root checks (`lint`, `format:check`, `typecheck`, `test:unit`, `test:integration`) and the `mobile/` checks.
- [x] 7.2 curl against the `test-db` dev server with the seeded e2e rider: the detail of a return parcel has the contact; return it (200); repeat (409); a random parcel (404); an on-the-way parcel (409). Seed a `canceled_returned` parcel for the e2e rider first if the seed has none, and remove it afterwards. (Skipped: the user's own `next dev` held port 3000 and Next.js allows one dev server per folder. The integration test covers these routes against the local database. The return was then checked end to end on the phone.)
- [x] 7.3 On the user's phone in Expo Go: open a return from its card and detail, call the merchant, cancel and then confirm a return, check it moves to the Returned tab, and check the web rider page and admin parcel views agree. (The first try hit a stale dev-server build of rider-operations.ts; a restart fixed it.)
- [x] 7.4 Update the roadmap status in `docs/mobile-app.md`.
