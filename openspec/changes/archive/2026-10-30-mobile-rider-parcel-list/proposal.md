## Why

Riders can now sign in to the Expo app (slice 2), but they land on a placeholder home screen. Their real job is the parcel list: who to deliver to, where, and how much to collect. This slice brings the rider's assigned parcels into the app, read-only, as the base for the delivery actions in slices 4 to 7. See `docs/mobile-app.md`; this is slice 3 of 9.

## What Changes

- **Server**: two rider-scoped, read-only endpoints. Both reuse the existing DAL and the `requireMobileRider()` guard from slice 1.
  - `GET /api/mobile/v1/rider/parcels?tab=&page=` returns one page of the rider's parcels for a tab (`to_deliver`, `delivered`, `returned`) plus the tab counts. It reuses `listRiderParcelsPageForUser`.
  - `GET /api/mobile/v1/rider/parcels/[parcelId]` returns one parcel's details, only if it's assigned to the signed-in rider (404 otherwise). It reuses `getParcelByIdForRealtimeScope` with the rider scope.
- **Contract**: rider parcel list and detail schemas in `src/features/mobile-api/contract.ts`. They're a mobile-specific subset of `ParcelListItemDto`, with `amountToCollect` and `statusLabel` computed on the server, so the money and label rules stay in one place.
- **App**:
  - The home screen becomes the parcel list: three tabs with counts, parcel cards, infinite scroll, pull-to-refresh, and empty, loading and error states.
  - Lists refetch when the app returns to the foreground or reconnects.
  - Tapping a card opens a detail screen. Tapping the phone number starts a call.
  - Profile and sign-out move to a Profile screen, reached from the list header.
- **Docs**: update the roadmap status in `docs/mobile-app.md`.

## Capabilities

### New Capabilities

- `mobile-rider-parcel-list`: Read-only rider parcel list and parcel detail, through the mobile API and in the native app.

### Modified Capabilities

- `mobile-rider-app-shell`: the signed-in home screen is the parcel list. Profile and sign-out move to a separate screen.

## Impact

- New route handlers under `src/app/api/mobile/v1/rider/parcels/`, and new mapping code in `src/features/mobile-api/server/`.
- `src/features/mobile-api/contract.ts` gains parcel schemas (still zod-only).
- New screens in `mobile/src/app/(rider)/`, and query hooks in `mobile/src/api/`.
- No database changes, no changes to existing DAL functions or web screens.
- Out of scope: search, township and status filters (a later slice if riders need them), all write actions (slices 4 to 7), proof photos in the detail view, and realtime updates (slice 8).
