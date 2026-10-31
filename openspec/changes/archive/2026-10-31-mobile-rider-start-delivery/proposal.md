## Why

Riders can see their parcels in the Expo app (slice 3), but they still have to open the web page to start a delivery, the first thing they do each morning. This slice adds start delivery to the app, for one parcel or several at once. It's also the first write action on the mobile API, so it sets up the shared rider operation layer that slices 5 to 7 reuse. See `docs/mobile-app.md`; this is slice 4 of 9.

## What Changes

- **Shared operation**: move the body of `startDeliveryForRiderParcelsAction` (validate → permission check → `startDeliveryForRiderParcels` DAL → cache invalidation) into `startRiderDelivery()` in a new `src/features/parcels/server/rider-operations.ts`. The server action becomes a thin wrapper and keeps its `{ ok, message }` return shape and messages.
  - The DAL's start-delivery checks throw a typed `ParcelOperationError` with a `code`, using the same messages as today. Callers can then tell a rule violation from an unexpected failure.
  - The batch is capped at 50 parcels, which applies to the web as well. The web selects from a 12-card page, so this never blocks a real rider.
- **Cache invalidation**: the operation invalidates the same tags and paths the action does today, plus the rider's own `riderParcelsTag`. Route handlers can't call `updateTag`, and `revalidateParcelWriteCaches`'s `"max"` profile would serve the app stale data on the refetch right after the write. So the route path expires the tags immediately (`revalidateTag(tag, { expire: 0 })`) through a new option on `revalidateParcelWriteCaches`.
- **Server**: `POST /api/mobile/v1/rider/parcels/start-delivery` with a JSON body `{ parcelIds }`. 200 returns the started IDs; 400, 401, 403, 404 and 409 follow the mobile envelope.
- **Contract**: request and response schemas for start delivery in `src/features/mobile-api/contract.ts` (still zod-only).
- **App**:
  - `apiPost` next to `apiGet` in `mobile/src/api/client.ts`, sharing one request path.
  - "Start delivery" on each `at_office` card in the To deliver tab and on the detail screen. A single parcel starts on tap.
  - Checkboxes on `at_office` cards, and a bottom bar with the selected count, the total to collect and "Start delivery". Starting two or more asks for confirmation in a native dialog first.
  - No optimistic update: buttons show "Starting…" until the server replies, then the list and detail queries refetch.
- **Cleanup**: DAL counts are real numbers since ahp-sooyaa/parcel-flow#10, so `toMobileRiderParcelPage` drops its `coerceSqlNumber` calls and the unit test passes numbers straight through.
- **Docs**: roadmap status, and 404 and 409 in the API status code table, in `docs/mobile-app.md`.

## Capabilities

### New Capabilities

- `mobile-rider-start-delivery`: start delivery for one or several assigned `at_office` parcels through the mobile API and in the native app.

### Modified Capabilities

- `rider-parcel-card-workflow`: start delivery runs through one shared operation for the web and the app, and a batch is limited to 50 parcels.

## Impact

- New `src/features/parcels/server/rider-operations.ts` and `src/features/parcels/server/errors.ts`. `startDeliveryForRiderParcelsAction` in `src/features/parcels/server/actions.ts` delegates to it. `startDeliveryForRiderParcels` in the DAL throws `ParcelOperationError` instead of a plain `Error`, with unchanged messages.
- `revalidateParcelOperationalPaths` moves from `actions.ts` to `src/lib/cache-invalidation.ts` so both callers can use it. `revalidateParcelWriteCaches` gains an `expireNow` option; existing callers are unchanged.
- New route `src/app/api/mobile/v1/rider/parcels/start-delivery/route.ts`.
- `mobile/` gains `apiPost`, a `useStartDelivery` mutation, selection UI on the list, a start button on the card and detail screen, and a `success` tone for `Notice`.
- No database changes. Web rider screens are unchanged.
- Out of scope: idempotent retries (a retried request after a lost response returns 409, and the app refetches), an offline queue, realtime updates (slice 8), and any other rider action (slices 5 to 7).
