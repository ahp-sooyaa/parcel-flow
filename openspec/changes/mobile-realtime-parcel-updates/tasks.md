## 1. Server: shared stream helper

- [x] 1.1 Add `openParcelChangeStream({ request, channelName, limit, toEvent })` to `src/features/parcels/server/realtime-stream.ts`, moving the global cap (80), the per-key counts, the Supabase channel, `ready` / `stream-error`, the 20-second keepalive, one-time cleanup and `toParcelRealtimeRow` out of the web route.
- [x] 1.2 Make `src/app/api/realtime/parcels/route.ts` a thin caller: `requireCurrentUser()`, the surface check, the scope, the client-IP key with `max: 4`, and `buildParcelRealtimeEventForScope` as `toEvent`. Its events and status codes stay the same.
- [x] 1.3 Add `createRiderParcelChangeTracker(scope, initialParcelIds)` and `loadRiderParcelIds(riderId)` to `src/features/parcels/server/realtime.ts`: `parcel-changed` with `{ parcelId }` for a parcel that is the rider's now or was in the tracked set, with no database read per change. (First built from the old row, which Postgres doesn't send in full; the phone test found it.)

## 2. Contract and mobile route

- [x] 2.1 Add `MOBILE_RIDER_PARCEL_EVENTS_PATH`, `mobileParcelChangedEventSchema` and the event name type to `src/features/mobile-api/contract.ts`.
- [x] 2.2 Add `GET src/app/api/mobile/v1/rider/parcels/events/route.ts`: `requireMobileRider()` (401/403 JSON), the rider scope (500 JSON on failure), and `openParcelChangeStream` with key `rider:<userId>`, `max: 2`, and the new builder.

## 3. Server tests

- [x] 3.1 `tests/unit/parcel-realtime-stream.unit.test.ts` with a fake Supabase channel and fake timers: `ready`, sent and skipped events, keepalive, cleanup once on abort with the slot freed, the global and per-key caps (204), and `stream-error` on channel error. Spread the real exports into every `mock.module`.
- [x] 3.2 Web route unit: 400 for a bad surface, and upsert and remove events unchanged through the helper.
- [x] 3.3 `tests/unit/mobile-rider-parcel-events.unit.test.ts` with `mockMobileRouteSession`: 401, 403, the stream headers, `ready` then `parcel-changed` for the rider's parcel, nothing for another rider's, an event for a parcel reassigned away, and 204 past 2 streams for one rider while another rider still connects.
- [x] 3.4 Unit tests for the tracker with key-only old rows: becoming the rider's, staying theirs, reassigned, unassigned, soft- and hard-deleted (once, then forgotten), learned after the stream opened, and another rider's parcel skipped.
- [x] 3.5 Run each new or changed unit test file paired with every other unit and component test file to catch Bun mock leaks (in zsh, split the pair with `${=pair}`).

## 4. App

- [x] 4.1 Add `createSseParser(onEvent)` in `mobile/src/realtime/sse-parser.ts`.
- [x] 4.2 Add `useRiderParcelEvents()` in `mobile/src/realtime/use-rider-parcel-events.ts`: open while active with the cookie and `Accept`; batch `parcel-changed` into one-second invalidations; invalidate the lists on a reconnect `ready`; backoff 1 to 30 seconds with jitter; a 50-second silence watchdog; close on background and reopen on active; 401 signs out, 403 stops, 204 retries after 60 seconds; stop with both `reader.cancel()` and `abort()`. Keep functions small enough for Sonar's complexity limit.
- [x] 4.3 Call the hook from `mobile/src/app/(rider)/_layout.tsx` once there's a session.

## 5. App tests

- [x] 5.1 Parser tests: split chunks, `\r\n`, comments, multi-line `data:`, and the default event name.
- [x] 5.2 Hook tests with `fetch` mocked to return a controllable `ReadableStream` and fake timers: the request, batching, reconnect invalidation, backoff after the body ends, the watchdog, background and active, and the 401, 403 and 204 cases.

## 6. Verification and docs

- [x] 6.1 Run the root checks (`lint`, `format:check`, `typecheck`, `test:unit`, `test:integration`) and the `mobile/` checks.
- [x] 6.2 With curl against a dev server signed in as the e2e rider: the stream sends `ready`, keepalives, and `parcel-changed` when the rider's parcel is changed from another terminal; 401 without a session. Use the `test-db` server when port 3000 is free, otherwise ask the user to stop theirs for a minute.
- [x] 6.3 On the user's phone in Expo Go: with the app open, assign a parcel and resolve a failure from the web admin and see the app update within a few seconds without refreshing; background the app and check the server ends the stream; turn mobile data off and on and check it reconnects and catches up. (Found that a parcel resolved as a return and given to another rider never reached the first rider: Postgres sends only the key as an update's old row. Fixed with the per-stream parcel tracker, then retested.)
- [ ] 6.4 Update `docs/mobile-app.md`: the live updates row in section 2, slice 8's roadmap summary (the mobile events endpoint instead of `/api/realtime/parcels`), and its status.
