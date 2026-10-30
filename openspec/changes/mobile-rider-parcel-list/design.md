## Context

Overall context and roadmap: `docs/mobile-app.md`. This is slice 3 of 9.

What already exists:

- **Rider list query**: `listRiderParcelsPageForUser(userId, filters)` in `src/features/parcels/server/dal.ts`.
  - It returns `RiderParcelListPageDto`: `parcels`, `page`, `pageSize`, `totalCount`, `totalPages`, `hasAnyParcels`, `tabCounts`.
  - Tabs come from `riderParcelTabs` (`to_deliver`, `delivered`, `returned`) and `getRiderParcelTabStatuses`. `to_deliver` covers `at_office`, `on_the_way` and `canceled_returned`.
  - It's cached with `"use cache"` and the `riderParcelsTag(userId)` tag, which the existing rider write actions already invalidate.
- **Single parcel lookup**: `getParcelByIdForRealtimeScope(parcelId, { role: "rider", userId })`. It returns the parcel only when it's assigned to that rider's account, and skips the admin-only correction data.
- **Web card fields**: parcel code, receiver name, township, status label, receiver phone, receiver address, and "Amount to Collect" (`codAmount + deliveryFee`, in MMK).
- **Status labels**: `parcelStatusLabels` in `src/lib/domain.ts`.
- **From slices 1 and 2**: `requireMobileRider()`, `mobileOk` / `mobileError`, the zod-only contract, and the app's `apiGet(path, schema)`, `useMe()` and auth gate.

## Goals / Non-Goals

**Goals:**

- A rider sees exactly the parcels the web shows them, grouped by the same tabs, with the same amount to collect.
- The server owns scoping, the tab-to-status mapping, the amount-to-collect rule and status labels; the app only renders.
- Lists stay reasonably fresh without realtime: pull-to-refresh, refetch on app foreground and reconnect.

**Non-Goals:**

- Search and township/status filters (the web has them; add them to the app later if riders ask).
- Any write action: start delivery, deliver, failure notes, returns (slices 4 to 7).
- Proof-of-delivery images, correction logs, merchant contact details.
- Realtime (slice 8).

## Decisions

### Endpoints

```text
GET /api/mobile/v1/rider/parcels?tab=to_deliver&page=1
GET /api/mobile/v1/rider/parcels/{parcelId}
```

- Both start with `requireMobileRider()`: 401 without a session, 403 for inactive or non-rider users.
- **List**: `tab` (default `to_deliver`) and `page` (default 1) are validated with zod. An unknown tab or a page below 1 is a 400, not a silent fallback. The web's lenient `parseRiderParcelListFilters` stays web-only, because a mobile client sending bad input is a bug.
  - It calls `listRiderParcelsPageForUser(rider.id, { tab, page, pageSize: 20, searchTerm: "", townshipName: null, statuses: [] })`.
  - `pageSize` is 20 rather than the web's 12, because the app scrolls instead of paginating.
- **Detail**: `parcelId` must be a UUID (400 otherwise). It calls `getParcelByIdForRealtimeScope(parcelId, { role: "rider", userId: rider.id })`. `null` → 404 "Parcel not found." Another rider's parcel is indistinguishable from a missing one, so a rider can't probe for parcel IDs.

Both are plain route handlers like `src/app/api/mobile/v1/me/route.ts`. They don't touch the DAL's caching or tags.

### Mobile DTOs: a subset, computed on the server

The contract adds:

```ts
mobileParcelStatusSchema   // z.enum([...the six ParcelStatus values])
mobileRiderParcelTabSchema // z.enum(["to_deliver", "delivered", "returned"])
mobileParcelTypeSchema     // z.enum(["cod", "non_cod"])

mobileRiderParcelListItemSchema = {
  id, parcelCode, status, statusLabel,
  receiverName, receiverPhoneNumber, receiverAddress, townshipName,
  amountToCollect,          // codAmount + deliveryFee, MMK integer
  hasActiveFailureNote,     // boolean, so slice 6 can badge it
}

mobileRiderParcelDetailSchema = listItem + {
  merchantName, parcelType, codAmount, deliveryFee, weightKg,
  specialNotes, activeFailureNote: string | null, createdAt,  // the active note text only
}

mobileRiderParcelPageSchema = {
  parcels: listItem[], page, totalPages, totalCount,
  tabCounts: { to_deliver, delivered, returned },
}
```

- The contract can't import `@/lib/domain` (it stays alias-free for Metro). So the status and tab enums are written out in the contract, and a server-side `satisfies` check plus a unit test assert they equal `parcelStatuses`, `riderParcelTabs` and `parcelTypes`. Adding a status on the server then fails the build until the contract matches.
- `statusLabel` comes from `parcelStatusLabels` on the server, so web and app always use the same wording.
- `amountToCollect` is computed in the server mapper (`src/features/mobile-api/server/parcels.ts`). It's the same rule the web card uses today, defined once for mobile and covered by a test.
- Left out on purpose: `merchantId`, `riderId`, `riderName`, proof image keys, correction logs and tokens, failure note history, and parcel dimensions. The app doesn't need them, and a smaller payload is better on mobile data.

### App navigation

```text
mobile/src/app/(rider)/
├── _layout.tsx            # auth gate + Stack with headers
├── index.tsx              # parcel list (replaces the placeholder home)
├── parcels/[parcelId].tsx # parcel detail
└── profile.tsx            # profile + sign out (moved from index)
```

The Stack shows headers now: "Parcels" with a "Profile" header button, "Parcel" with a back button, and "Profile". This uses Expo Router's built-in native stack.

### List screen

- **Tabs**: three segmented buttons ("To deliver", "Delivered", "Returned"), each with its count from `tabCounts`. The selected tab is local state, defaulting to "To deliver".
- **Data**: `useInfiniteQuery` keyed `["rider-parcels", tab]`, with `getNextPageParam = page < totalPages ? page + 1 : undefined`. A `FlatList` calls `fetchNextPage` from `onEndReached`, and `RefreshControl` calls `refetch`.
- **Card**: code, status label, receiver name, township, phone, address, and amount to collect, formatted as `12,500 MMK`. The whole card is pressable and opens the detail screen.
- **States**: a loading spinner on first load. An empty state per tab ("No parcels to deliver right now."). An error notice with "Try again", where a network error shows the slice 2 connection message.

### Detail screen

- `useQuery(["rider-parcel", id])` calls the detail endpoint. The hook also returns `preview`, the parcel's row from any cached list page, so the screen shows the list fields at once and fills in the rest when the detail arrives. (TanStack's `placeholderData` would need a complete detail object, which a list row isn't.)
- It shows the card fields plus merchant, parcel type, COD and delivery fee breakdown, weight, special notes, and the active failure note.
- **Phone**: tapping the phone number calls `Linking.openURL("tel:…")`, which Expo Go supports.
- A 404 shows "This parcel is no longer assigned to you." with a button back to the list. That happens when an admin reassigns it while the rider has it open.

### Freshness without realtime

`mobile/src/api/query-client.ts` wires TanStack Query's `focusManager` to React Native `AppState`, and `onlineManager` to `expo-network`, following the TanStack React Native recipe. Active queries refetch when the app comes back to the foreground or the phone reconnects. List queries use `staleTime: 30s`, so switching tabs doesn't refetch every time.

### Tests

- **Server unit** (`tests/unit/mobile-rider-parcels.unit.test.ts`, mocking `@/lib/auth` and `next/headers` the way slice 1 does, plus the parcels DAL with the real exports spread in): 401, 403, 400 for a bad tab, page and UUID, the 404 mapping, filter values passed to the DAL, the DTO mapping (`amountToCollect`, `statusLabel`, omitted fields), and the contract enums matching the domain lists.
- **Server integration** (`tests/integration/mobile-rider-parcels.integration.test.ts`): seed two riders with parcels in different statuses. Rider A's list per tab contains only A's parcels with the right counts. A's detail works. B's parcel is a 404 for A.
- **App Jest**: the list renders cards and tab counts, switches tabs, and shows the empty and error states. The detail renders the fields, makes the phone tappable, and handles 404.

## Implementation notes

- **String counts from Postgres**: postgres-js returns `count(*)` (bigint) as a string, although the DAL types `totalCount` and `tabCounts` as numbers. The web never noticed because it only renders them. The integration test caught it against the strict contract. `toMobileRiderParcelPage` converts them with the existing `coerceSqlNumber` (`src/lib/format.ts`), and a unit test pins it. The same `sql<number>\`count(\*)\`` pattern is used across the DAL (admin, merchant and summary counts); fixing it there is a separate cleanup.
- **Typed routes**: Expo Router generates route types into the gitignored `.expo/types` when `expo start` runs. A stale copy makes `tsc` reject new routes, and restarting `expo start` regenerates it. CI has no copy, so it typechecks hrefs loosely.
- **Jest setup**: `mobile/jest.setup.ts` now gives every test a signed-out auth client (the real Better Auth client is ESM that Jest can't load) and an `expo-network` stub whose listener returns a removable subscription.

## Risks / Trade-offs

- [`"use cache"` in route handlers] `listRiderParcelsPageForUser` is cached per rider and tag, so a mobile read may be up to the cache lifetime old if a write path forgets to invalidate the tag → the existing rider and admin write actions already call `revalidateParcelWriteCaches`, and slices 4 to 7 reuse those shared operations.
- [Contract enums duplicated] Statuses and tabs are written out in the contract → the `satisfies` check and unit test catch drift at build and test time.
- [Offset pagination while data changes] A parcel moving tabs between page loads can shift items → acceptable for v1; pull-to-refresh resets to page 1.
- [Amount rule lives in two places] The web card computes `codAmount + deliveryFee` in a component, and mobile computes it in the server mapper → noted in the mapper; a later cleanup can move the web card onto the same helper.

## Migration Plan

Only additive server changes, and the app screens are new. Rollback is reverting the new routes and app screens; slice 2's placeholder home comes back with the revert.
