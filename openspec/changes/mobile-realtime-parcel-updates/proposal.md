## Why

The rider app only learns about changes when the rider pulls to refresh, opens a screen, or brings the app back to the foreground. When an admin assigns a new parcel, resolves a failure as a return, or reassigns a parcel to someone else, the rider doesn't see it until they act. The web dashboards already update live through `/api/realtime/parcels`. This slice gives the app the same live updates. See `docs/mobile-app.md`; this is slice 8 of 9.

The web stream doesn't suit the app as it is:

- It sends the web's full parcel DTO, which the mobile contract deliberately doesn't expose.
- It authenticates with the web session helper rather than `requireMobileRider()`, so the mobile 401/403 rules don't apply.
- It allows only 4 open streams per IP. Riders on the same mobile carrier often share one public IP (carrier NAT), so the fifth rider in a city would get no live updates.

## What Changes

- **Shared stream helper**: move the SSE plumbing from `src/app/api/realtime/parcels/route.ts` (connection caps, Supabase channel, heartbeat, cleanup) into `openParcelChangeStream()` in `src/features/parcels/server/realtime-stream.ts`. The web route becomes a thin caller with unchanged behaviour, and both routes share one global cap.
- **Server**: `GET /api/mobile/v1/rider/parcels/events`, a `text/event-stream` for the signed-in rider.
  - It sends `ready`, then a `parcel-changed` event `{ parcelId }` whenever one of the rider's parcels changes, or stops being theirs. Keepalive comments keep the connection open.
  - Events carry only the id; the app refetches through the existing endpoints, so no parcel data goes over the stream and the contract stays as it is.
  - It allows 2 streams per rider rather than per IP, and returns 204 when a cap is reached.
  - 401/403 come from `requireMobileRider()` as JSON.
- **Contract**: the event names and the `parcel-changed` payload schema.
- **App**:
  - A `useRiderParcelEvents()` hook in the rider layout reads the stream with `fetch` (React Native has no `EventSource`).
  - It refetches the lists and the changed parcel's detail, batched over one second so a burst of changes means one refetch.
  - It closes the stream when the app goes to the background and reopens it when the app comes back, refetching then to catch anything missed.
  - It reconnects with backoff after drops, restarts the stream if it goes silent, and gives up quietly when the server is at capacity, leaving today's refetch-on-focus behaviour.
- **Docs**: `docs/mobile-app.md` (the live updates row and the roadmap status).

## Capabilities

### New Capabilities

- `mobile-realtime-parcel-updates`: live parcel change notifications for the signed-in rider, through the mobile API and in the native app.

### Modified Capabilities

- `realtime-parcel-sync`: the web and mobile parcel streams share one stream helper and one global connection budget; the mobile stream limits connections per rider instead of per IP.

## Impact

- New `src/features/parcels/server/realtime-stream.ts`; `src/app/api/realtime/parcels/route.ts` delegates to it.
- New route `src/app/api/mobile/v1/rider/parcels/events/route.ts`, and a rider change-event builder in `src/features/parcels/server/realtime.ts` that needs no database read per event.
- `mobile/` gains an SSE line parser, the events hook, and its use in the rider layout. No new packages.
- No database changes. Each open app holds one Supabase realtime channel while in the foreground, from the same budget as web dashboards (80 streams).
- Out of scope: push notifications when the app is closed, the offline action queue, showing a live/offline indicator, and live updates for admins or merchants in the app.
