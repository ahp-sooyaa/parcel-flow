## 1. Contract

- [x] 1.1 Add `mobileParcelStatusSchema`, `mobileRiderParcelTabSchema`, `mobileParcelTypeSchema`, `mobileRiderParcelListItemSchema`, `mobileRiderParcelDetailSchema` and `mobileRiderParcelPageSchema`, with response wrappers, to `src/features/mobile-api/contract.ts`. Keep the file zod-only, with no `@/` imports.

## 2. Server

- [x] 2.1 Add `src/features/mobile-api/server/parcels.ts`: map `ParcelListItemDto` to the list item and detail DTOs (`amountToCollect = codAmount + deliveryFee`, `statusLabel` from `parcelStatusLabels`), with `satisfies` checks that the contract enums match `parcelStatuses`, `riderParcelTabs` and `parcelTypes`.
- [x] 2.2 Add `GET src/app/api/mobile/v1/rider/parcels/route.ts`: `requireMobileRider()`, zod-validate `tab` and `page` (400 on bad input), call `listRiderParcelsPageForUser` with `pageSize: 20` and no search or filters, and return the page DTO.
- [x] 2.3 Add `GET src/app/api/mobile/v1/rider/parcels/[parcelId]/route.ts`: `requireMobileRider()`, UUID check (400), `getParcelByIdForRealtimeScope` with the rider scope, and 404 "Parcel not found." for `null`.

## 3. Server tests

- [x] 3.1 Unit tests (`tests/unit/mobile-rider-parcels.unit.test.ts`): 401 and 403, 400 for a bad tab, page and UUID, the filter values passed to the DAL, the 404 mapping, the DTO fields (including omitted ones), and the contract enums equal to the domain lists. Spread the real module exports into any partial mocks.
- [x] 3.2 Integration test (`tests/integration/mobile-rider-parcels.integration.test.ts`): two seeded riders with parcels in several statuses. Each tab and its counts contain only the signed-in rider's parcels; the detail works for their own parcel and is a 404 for the other rider's.

## 4. App data layer

- [x] 4.1 Wire TanStack `focusManager` to `AppState` and `onlineManager` to `expo-network` in `mobile/src/api/query-client.ts`.
- [x] 4.2 Add `mobile/src/api/parcels.ts` with `useRiderParcels(tab)` (`useInfiniteQuery`, `staleTime` 30s) and `useRiderParcel(id)` (`useQuery`, returning the cached list row as `preview` until the detail arrives).
- [x] 4.3 Add a `formatMmk` helper (for example `12,500 MMK`) with a unit test.

## 5. App screens

- [x] 5.1 Show Stack headers in `(rider)/_layout.tsx` ("Parcels", "Parcel", "Profile"), with a Profile header button on the list.
- [x] 5.2 Move the profile and sign-out UI from `(rider)/index.tsx` to `(rider)/profile.tsx`.
- [x] 5.3 Build the parcel list in `(rider)/index.tsx`: tabs with counts, a `FlatList` of parcel cards, `onEndReached` paging, pull-to-refresh, and loading, empty and error states.
- [x] 5.4 Build the detail in `(rider)/parcels/[parcelId].tsx`: all detail fields, a tappable phone (`tel:`), and the "no longer assigned" state on 404.

## 6. App tests

- [x] 6.1 Jest tests for the list screen: cards and tab counts render, switching tabs requests the new tab, and the empty and error states with "Try again" work.
- [x] 6.2 Jest tests for the detail screen: fields render, tapping the phone opens `tel:`, and a 404 shows the "no longer assigned" state.
- [x] 6.3 Update the sign-out test coverage for the move to the Profile screen, if it's affected. (Not affected: no slice 2 test rendered the old home screen.)

## 7. Verification and docs

- [x] 7.1 Run the root checks (`lint`, `format:check`, `typecheck`, `test:unit`, `test:integration`) and the `mobile/` checks.
- [x] 7.2 curl against the dev server with a seeded rider: the list per tab, the detail, a 400 for a bad tab, and a 404 for another rider's parcel.
- [x] 7.3 On the user's phone in Expo Go: the tabs and counts match the web rider page, scrolling loads more, pull-to-refresh works, the detail opens, tapping the phone opens the dialer, and the Profile screen signs out. (Confirmed on the user's Android phone: tabs, counts (1 to deliver, 0 elsewhere), the detail screen and the Profile screen. Loading more pages wasn't exercised with a single parcel; it's covered by the API's paging and the Jest list tests.)
- [x] 7.4 Update the roadmap status in `docs/mobile-app.md`.
