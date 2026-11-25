## Context

Overall context and roadmap: `docs/mobile-app.md`. This is slice 8 of 9. Slices 4 to 7 added every rider write to the app; their mutations already refetch the lists and the parcel's detail when they settle. Slice 6's shared fixtures and components are there to reuse, because SonarCloud fails above 3% duplicated new code or a function's cognitive complexity over 15.

What already exists:

- **Web stream** `GET /api/realtime/parcels?surface=…` (`src/app/api/realtime/parcels/route.ts`):
  - `requireCurrentUser()`, then validates `surface` (400 JSON).
  - Caps open streams: 80 in total (the Supabase free plan allows 100 channels per socket) and 4 per client IP (`getClientIp`). Over a cap it returns 204, which tells `EventSource` to stop retrying.
  - Opens one Supabase realtime channel per stream on `postgres_changes` for `public.parcels`, with a 20-second `: keepalive` comment, and cleans up on abort, channel close or stream cancel.
  - For each change, `buildParcelRealtimeEventForScope()` (`src/features/parcels/server/realtime.ts`) checks visibility for the viewer's scope (a rider sees rows whose `rider_id` is theirs), then loads the full `ParcelListItemDto` and sends `parcel-upsert`, or sends `parcel-remove`. Summary surfaces get `stats-invalidated`.
  - Event frames: `event: <type>\ndata: <json>\n\n`; also `ready` and `stream-error`.
- **Web client** `useParcelRealtimeEvents()` uses `EventSource` and closes the stream while the tab is hidden.
- **App**:
  - TanStack Query refetches active queries when the app comes to the foreground or reconnects (`mobile/src/api/query-client.ts`), and on pull-to-refresh.
  - Query keys: `["rider-parcels", tab]` and `["rider-parcel", id]`.
  - Expo SDK 58 installs `expo/fetch` as the global `fetch` on Android and iOS. Its docs show streaming bodies through `response.body.getReader()`, but say nothing about aborting or long-lived streams. Slice 5 already found an `expo/fetch` difference only on the phone.
  - React Native has no `EventSource`.

## Goals / Non-Goals

**Goals:**

- A rider sees assignments, reassignments, admin resolutions and corrections within a few seconds while the app is open.
- No parcel data on the stream beyond an id; the existing endpoints and contract stay the single source.
- Riders behind one carrier IP don't lock each other out.
- Nothing kept open in the background, and no extra battery or data when nothing changes.

**Non-Goals:**

- Push notifications while the app is closed (Later Ideas in `docs/mobile-app.md`).
- Admin or merchant live updates in the app.
- A visible live/offline indicator.

## Decisions

### Shared stream helper

`src/features/parcels/server/realtime-stream.ts`:

```ts
export function openParcelChangeStream(input: {
  request: Request;
  channelName: string;
  /** Per-client cap: the web uses the client IP, the app the rider's user id. */
  limit: { key: string; max: number };
  /** Turns one parcels row change into an event to send, or null to skip it. */
  toEvent: (change: {
    nextRow: ParcelRealtimeRow | null;
    previousRow: ParcelRealtimeRow | null;
  }) => Promise<{ type: string; payload: unknown } | null>;
}): Response;
```

- The module owns the global count (80) and a count per limit key, so web and mobile streams share one budget against the Supabase channel limit.
- Over a cap it returns `new Response(null, { status: 204 })`.
- It keeps today's behaviour: one channel per stream, `ready` on subscribe, `stream-error` on channel error or timeout, the 20-second keepalive, and cleanup (release the slot, clear the heartbeat, remove the channel, close) on abort, channel close or cancel, exactly once.
- `toParcelRealtimeRow` moves into this module.
- The web route keeps `requireCurrentUser()`, the surface check, `loadParcelRealtimeScopeContext`, and the IP key with `max: 4`. Its `toEvent` calls `buildParcelRealtimeEventForScope` as now, so web events don't change.

### Mobile endpoint

```text
GET /api/mobile/v1/rider/parcels/events
Accept: text/event-stream
```

1. `requireMobileRider()`: no session → 401 JSON, not a rider → 403 JSON, so the app can tell "sign in again" from "stop".
2. `loadParcelRealtimeScopeContext(rider)` gives the rider's `riderId` (500 JSON if it fails).
3. `openParcelChangeStream` with key `rider:<userId>` and `max: 2` (a phone briefly overlapping an old and a new stream during reconnect, plus room for a second device).
4. `loadRiderParcelIds(riderId)` reads the ids of the parcels currently assigned to the rider (one query per stream open).
5. `toEvent` is `createRiderParcelChangeTracker(scope, thoseIds)` in `realtime.ts`. It keeps a set of the rider's parcel ids: a change to a parcel that is the rider's now, or is in the set, returns `{ type: "parcel-changed", payload: { parcelId } }` and updates the set; anything else returns `null`.
   - The set is needed because `parcels` uses Postgres's default replica identity: an update's or delete's old row carries only the primary key, so the change alone can't show that a parcel used to be this rider's. Found on the phone: a parcel resolved as a return (rider cleared) and given to another rider never reached the first rider. `REPLICA IDENTITY FULL` was not used: it makes every parcel write log the whole old row, and the helper now passes `parcelId` from the new or old row's key instead.
   - No database read per event, unlike the web's upsert, so a busy table costs the server little per open app.
   - A parcel reassigned away, unassigned or deleted sends the event once and leaves the set, and the refetch drops it from the app.

Frames match the web stream:

```text
event: ready
data: {}

event: parcel-changed
data: {"parcelId":"…"}

: keepalive
```

Route handlers have no response timeout of their own. The client reconnects whenever the stream ends, so a proxy that ends long requests (Railway's limits included) only causes a short gap, covered by the refetch on reconnect.

### Contract

```ts
export const MOBILE_RIDER_PARCEL_EVENTS_PATH = "/rider/parcels/events";
export const mobileParcelChangedEventSchema = z.object({ parcelId: z.string() });
export type MobileParcelStreamEventName = "ready" | "parcel-changed" | "stream-error";
```

The server builds its payload with the schema's type, and the app parses with it.

### App: reading the stream

`mobile/src/realtime/sse-parser.ts`, a small pure parser:

- `createSseParser(onEvent)` returns `push(chunk: string)`.
- It keeps a partial-line buffer, handles `\n` and `\r\n`, ignores `:` comments, reads `event:` and `data:` (joining several `data:` lines with `\n`), and emits `{ event, data }` on a blank line (`event` defaults to `message`).
- Unit-tested on split chunks, comments and multi-line data.

`mobile/src/realtime/use-rider-parcel-events.ts`, `useRiderParcelEvents()`, used once in `mobile/src/app/(rider)/_layout.tsx` once there's a session:

- **Open** while `AppState` is `active`: `fetch(apiUrl + MOBILE_API_BASE_PATH + path, { headers: { Accept: "text/event-stream", Cookie: authClient.getCookie() }, credentials: "omit", signal })`, then read `response.body.getReader()` with a `TextDecoder` into the parser.
- **Responses**:
  - 401: stop and call `signOutRider()`, like the API client.
  - 403: stop.
  - 204 (server at capacity): retry after 60 seconds; the app keeps working on refetch-on-focus meanwhile.
  - Other non-200: reconnect with backoff.
- **Events**:
  - `parcel-changed`: add the id to a pending set. A one-second timer then invalidates `["rider-parcels"]` once and `["rider-parcel", id]` for each pending id. A batch start delivery of 20 parcels causes one list refetch, not 20.
  - `ready`: reset the backoff. If this `ready` follows a dropped stream (not the first open, and not a return from the background, which the focus refetch already covers), invalidate `["rider-parcels"]` to catch changes made while disconnected.
  - `stream-error`: drop the connection and reconnect.
- **Reconnect**: when the body ends or errors, wait 1, 2, 4, 8, 16, then 30 seconds (with ±20% jitter so phones don't reconnect in step after a server restart), then reopen.
- **Watchdog**: if no bytes arrive for 50 seconds (the keepalive is 20), treat the stream as dead and reconnect. Mobile networks can silently drop a connection without ending it.
- **Background**: on `AppState` → `background`, cancel the reader and abort the request, clear timers. On → `active`, reopen. The existing focus refetch covers what happened meanwhile.
- **Stopping a stream**: both `reader.cancel()` and `AbortController.abort()`, because the Expo docs don't confirm abort support. The phone test checks that the server releases the slot (the web route's logs show the stream ending).
- **Sign out**: the layout unmounts the hook, which stops the stream.

Live updates don't replace the existing refetches; they make most of them unnecessary.

### Tests

- **Stream helper unit** (`tests/unit/parcel-realtime-stream.unit.test.ts`), with a fake Supabase channel:
  - `ready` on subscribe, events from `toEvent`, a skipped `null`, the keepalive (fake timers)
  - cleanup once on abort, freeing the slot
  - the global and per-key caps returning 204
  - `stream-error` on channel error
- **Web route unit**: 400 for a bad surface, and its events unchanged (upsert and remove through the helper).
- **Mobile route unit** (`tests/unit/mobile-rider-parcel-events.unit.test.ts`, with `mockMobileRouteSession`): 401, 403, the stream headers, `ready` then `parcel-changed` for the rider's parcel, nothing for another rider's, an event for a parcel reassigned away, and 204 past 2 streams for one rider while another rider still connects.
- **Event builder unit**: visible before, after, both and neither.
- **App Jest**:
  - The parser.
  - The hook, with `fetch` mocked to return a controllable `ReadableStream` and fake timers:
    - opens with the cookie and `Accept`
    - batches several `parcel-changed` into one list invalidation plus each detail
    - invalidates on reconnect `ready`
    - reconnects with backoff after the body ends
    - the watchdog reconnecting
    - background closes it and active reopens it
    - 401 signs out, 403 stops, 204 waits 60 seconds

## Risks / Trade-offs

- [`expo/fetch` streaming on a real phone] The docs show it, but slice 5 met a difference only found on the phone → the phone test covers live updates, background and reconnect; if streaming fails there, the fallback is polling the list every 30 seconds while active, which this hook's structure can switch to.
- [Shared 80-stream budget] Each open app takes one Supabase channel → apps hold it only in the foreground; past the cap they fall back to today's refetches. The cap, the channel-per-stream design and moving to one shared channel are worth revisiting before many riders use the app.
- [Per-rider limit of 2] Someone with three devices loses live updates on one → harmless, it still refetches on focus.
- [Battery and data] The keepalive is a few bytes every 20 seconds, only while the app is open.
- [More refetches] Every change to the rider's parcel rows (including payout-status recomputes) triggers a refetch → batched to one per second, and those are the rider's own few rows.

## Migration Plan

No database changes. The web stream keeps its events and limits; the mobile route and hook are additive. Rollback is reverting the change; the app then behaves as in slice 7.
