## Context

Overall context and roadmap: `docs/mobile-app.md`. This is slice 4 of 9, and the first mobile write action.

What already exists:

- **Server action**: `startDeliveryForRiderParcelsAction(input)` in `src/features/parcels/server/actions.ts`.
  - It validates `{ parcelIds: uuid[] }` with at least one ID ("Invalid parcel selection.", "Select at least one parcel.").
  - It rejects anyone who isn't a rider allowed `at_office → on_the_way` by `canChangeParcelStatus` ("You do not have permission to start delivery.").
  - It calls the DAL and returns any thrown `Error`'s message as `{ ok: false, message }`, then calls the private `revalidateParcelOperationalPaths()`. On success it returns "Parcel moved to on the way." or "Selected parcels moved to on the way.".
  - Its only caller is `src/features/parcels/components/rider-parcel-card-list.tsx`. There's no unit test for it today.
- **DAL**: `startDeliveryForRiderParcels({ parcelIds, riderUserId, actorRole: "rider" })` in `src/features/parcels/server/dal.ts`.
  - It de-duplicates the IDs and runs one transaction. It locks the parcels with `SELECT … FOR UPDATE`, then checks, in order:
    1. the rider is active ("Active rider profile was not found.")
    2. every parcel exists and isn't deleted ("One or more selected parcels were not found.")
    3. every parcel is assigned to this rider ("You can only start delivery for parcels assigned to your rider account.")
    4. every parcel is `at_office` ("Only assigned at-office parcels can be started for delivery.")
  - The update is also guarded by `riderId` and `status = at_office`; a row-count mismatch throws "One or more selected parcels are no longer eligible to start delivery.".
  - It then inserts one pending `delivery_attempt` rider way payout per parcel and the status logs, and recomputes payout statuses.
  - It's **all or nothing**: one bad parcel rejects the whole batch, and nothing is written. There's no partial-success result to report.
- **Cache helpers** (`src/lib/cache-invalidation.ts`):
  - `invalidateParcelWriteCaches()` uses `updateTag`, which only works in a Server Action and throws in a route handler.
  - `revalidateParcelWriteCaches()` uses `revalidateTag(tag, "max")`, which is route-safe but stale-while-revalidate: the next read is served the old data while it refreshes.
  - The rider list (`listRiderParcelsPageForUser`) is tagged `riderParcelsTag(userId)` and `parcels`. The parcel detail lookup (`getParcelByIdForRealtimeScope`) isn't cached.
- **From slices 1 to 3**: `requireMobileRider()`, `mobileOk` / `mobileError`, the zod-only contract, `apiGet` and `MobileApiError`, and the `["rider-parcels", tab]` and `["rider-parcel", id]` queries.

## Goals / Non-Goals

**Goals:**

- The web and the app start deliveries through one function, with one set of rules and messages.
- After a start from the app, the app's refetch and the web's next render both show the parcels as on the way.
- A rider can start one parcel in one tap, or a morning batch in a few taps, without starting the wrong ones by accident.

**Non-Goals:**

- Changing what the web rider page does or shows.
- Idempotent retries, an offline queue, or optimistic UI.
- Mark delivered, failure notes and returns (slices 5 to 7).

## Decisions

### Shared operation

`src/features/parcels/server/rider-operations.ts` (no `"use server"`, so it isn't exposed as an endpoint):

```ts
type ParcelOperationCaller = "server-action" | "route-handler";

type StartRiderDeliveryResult =
  | { ok: true; message: string; parcelIds: string[] } // de-duplicated, as started
  | {
      ok: false;
      reason: "invalid" | "forbidden" | "not_found" | "conflict" | "failed";
      message: string;
    };

export async function startRiderDelivery(
  actor: CurrentUser,
  input: unknown,
  options: { caller: ParcelOperationCaller },
): Promise<StartRiderDeliveryResult>;
```

1. **Validate** with `startDeliveryInputSchema`, moved here from `actions.ts` and capped at 50 IDs ("Select up to 50 parcels at a time."). Failure → `invalid` with the first issue's message, as today.
2. **Authorize**: the same `actor.role !== "rider" || !canChangeParcelStatus(...)` check. Failure → `forbidden`.
3. **DAL**: call `startDeliveryForRiderParcels`. A `ParcelOperationError` maps to its `code`; any other error → `failed`.
4. **Invalidate** on success: `revalidateParcelOperationalPaths({ caller, riderUserId: actor.id })`.

The caller passes the actor in, because the action and the route resolve the session differently (`requireCurrentUser()` vs `requireMobileRider()`).

The server action becomes:

```ts
export async function startDeliveryForRiderParcelsAction(input: unknown) {
  const actor = await requireCurrentUser();
  const result = await startRiderDelivery(actor, input, { caller: "server-action" });
  return result.ok
    ? { ok: true as const, message: result.message }
    : { ok: false as const, message: result.message };
}
```

Its return shape and every message stay the same. The only new rejection is a batch over 50. For a `failed` (unexpected) error the operation's message is still the raw `error.message`, as today, so the web shows exactly what it showed before; only the mobile route hides unexpected messages.

### Typed DAL errors

`src/features/parcels/server/errors.ts`:

```ts
export class ParcelOperationError extends Error {
  constructor(readonly code: "forbidden" | "not_found" | "not_assigned" | "conflict", message: string)
}
```

`startDeliveryForRiderParcels` throws it for its five checks, with the messages unchanged: inactive rider → `forbidden`; missing parcel → `not_found`; another rider's parcel → `not_assigned`; not `at_office`, or the guarded update matching fewer rows → `conflict`. The operation maps `not_assigned` to `not_found`. Other DAL functions keep throwing plain `Error` until their slice moves them over.

Matching on message strings was the alternative. It's fragile, and the web's messages would become an API contract.

### Cache invalidation

`revalidateParcelOperationalPaths` moves from `actions.ts` to `src/lib/cache-invalidation.ts` and takes `{ caller, riderUserId? }`:

- `"server-action"`: `invalidateParcelWriteCaches({ riderUserId })` (`updateTag`, read-your-own-writes), as now.
- `"route-handler"`: `revalidateParcelWriteCaches({ riderUserId, expireNow: true })`. The new `expireNow` option passes `{ expire: 0 }` instead of `"max"`, so the next read blocks for fresh data instead of getting the stale list. Without it, the app's refetch right after a start would show the parcels still at the office.
- Both then `revalidatePath` the same five dashboard paths as today.

The other actions in `actions.ts` that call `revalidateParcelOperationalPaths()` keep working with `{ caller: "server-action" }` and no rider ID. Passing `riderUserId` for start delivery is redundant today (the rider list is also tagged `parcels`), but it keeps the rider's tag correct if that list's tags are narrowed later.

The existing `POST /api/rider/parcels/deliver` route keeps `"max"`; slice 5 decides whether to move it.

### Endpoint

```text
POST /api/mobile/v1/rider/parcels/start-delivery
Content-Type: application/json
{ "parcelIds": ["<uuid>", ...] }
```

| Result                                   | Status | Body                                                         |
| ---------------------------------------- | ------ | ------------------------------------------------------------ |
| Started                                  | 200    | `{ ok: true, message, data: { parcelIds } }`                 |
| Not JSON, or fails validation            | 400    | "A valid JSON body is required." or the validation message   |
| No session                               | 401    | from `requireMobileRider()`                                  |
| Inactive or not a rider, or `forbidden`  | 403    | from `requireMobileRider()`, or the operation's message      |
| `not_found` (missing or another rider's) | 404    | "One or more selected parcels were not found." in both cases |
| `conflict` (not `at_office` any more)    | 409    | the DAL message                                              |
| `failed`                                 | 500    | "Unable to start delivery."                                  |

- A missing parcel and another rider's parcel get the same 404, as the slice 3 detail endpoint does, so a rider can't probe for parcel IDs. The web keeps its two distinct messages.
- `start-delivery` is a static segment next to `[parcelId]`, and Next.js matches static segments first.
- No rate limit, matching the web action. Demo mode behaves as on the web (no demo-specific branch today).

### Contract

```ts
mobileStartDeliveryRequestSchema = z.object({
  parcelIds: z.array(z.uuid()).min(1).max(50),
});
mobileStartDeliveryResultSchema = z.object({ parcelIds: z.array(z.string()) });
mobileStartDeliveryResponseSchema = mobileSuccessResponseSchema(mobileStartDeliveryResultSchema);
```

The server validates with the operation's own schema, which is the single source of the rules and messages. The contract's request schema types the app's body. A unit test parses the same valid and invalid inputs with both and expects the same outcome, so they can't drift.

### App: data layer

- `mobile/src/api/client.ts`: an internal `request(method, path, schema, body?)` holds today's `apiGet` logic (Cookie header, `credentials: "omit"`, network error → status 0, 401 → sign out, envelope parsing). `apiGet(path, schema)` keeps its signature. `apiPost(path, body, schema)` sends JSON with `Content-Type: application/json`.
- `mobile/src/api/parcels.ts`: `useStartDelivery()` is a `useMutation` that posts `{ parcelIds }`. On settle, success or error, it invalidates `["rider-parcels"]` (every tab, since counts move between tabs) and `["rider-parcel", id]` for each ID. A 404 or 409 means the server's state differs from the screen, so a refetch is the fix.
- **No optimistic update** (decided with the user). The server also writes a payout record, and on a slow connection a card that flips and then flips back is more confusing than a short "Starting…".

### App: list screen

- **Single start**: each `at_office` card on the To deliver tab shows a "Start delivery" button in its footer. Tapping it starts that parcel straight away, as on the web. The card body still opens the detail screen.
- **Selection** (decided with the user: checkboxes, as on the web): `at_office` cards show a checkbox. Other statuses, including `canceled_returned`, show none.
  - Selection is local state on the list screen. It's cleared when switching tabs, and pruned to IDs that are still `at_office` in the loaded pages after every refetch.
  - With one or more selected, a bottom bar shows "3 selected · 37,500 MMK to collect", a "Clear" link and "Start delivery".
- **Confirmation** (decided with the user: several only): with two or more selected, "Start delivery" opens `Alert.alert("Start delivery for 3 parcels?", "37,500 MMK to collect.", [Cancel, Start])`. One selected parcel starts without a dialog, like the card button.
- **While pending**: one start runs at a time. Every start button and checkbox is disabled, and the pressed button shows "Starting…".
- **Result**: a `Notice` at the top of the list shows the server's message, in the new `success` tone (DESIGN.md teal, already in the tokens as `successInk` and `successSoft`) or `danger` on error. Starting, switching tabs or pulling to refresh clears it. On success the started IDs leave the selection.

The checkbox is a small `Pressable` with `accessibilityRole="checkbox"` and `accessibilityState={{ checked, disabled }}`; no new dependency. `ParcelCard` gains optional `selection` and `onStartDelivery` props, so the Delivered and Returned tabs render as before.

### App: detail screen

For an `at_office` parcel, the detail screen shows a "Start delivery" button with no confirmation. On success the detail refetches and shows "On the way", with the server message in a success `Notice`. On 404 the existing "no longer assigned" state appears after the refetch. On 409 the error message shows and the refetched status replaces the button.

### Idempotency and concurrency

- **Double tap**: the button is disabled while pending. A second request that still gets through returns 409, because the parcel is no longer `at_office`. No second payout row is written: the guarded update and the row lock stop it.
- **Retry after a lost response**: if the server committed but the app never saw the reply, a retry returns 409. The app refetches and shows the parcel on the way. That's the right state with a misleading message; acceptable for v1, and the offline queue idea in `docs/mobile-app.md` would need real idempotency keys anyway.
- **Concurrent web and app, or an admin reassigning**: `SELECT … FOR UPDATE` serializes them. The loser gets `not_found` (reassigned) or `conflict` (already started) and nothing partial is written.

### Tests

- **Server unit, operation** (`tests/unit/rider-operations.unit.test.ts`): `invalid` (empty, non-UUID, over 50), `forbidden` for a non-rider, `ParcelOperationError` codes mapped (`not_assigned` → `not_found`), plain errors → `failed`, the started IDs de-duplicated, and the invalidation helper called with the right caller and rider ID. The DAL and `next/cache` mocks spread the real module exports.
- **Server unit, action** (`tests/unit/parcel-actions.unit.test.ts`): start delivery returns the same messages as before for single and batch success, validation, permission and a DAL error, and calls `updateTag`, not `revalidateTag`. Add `startDeliveryForRiderParcelsAction` to the destructured imports.
- **Server unit, route** (`tests/unit/mobile-rider-start-delivery.unit.test.ts`): 401, 403, 400 for non-JSON and bad bodies, 404 and 409 mapping, 500 hides the message, 200 body parses with the contract, `revalidateTag` called with `{ expire: 0 }`. Also the contract and server schemas agree on the same fixtures.
- **Cache helper unit**: `expireNow` passes `{ expire: 0 }`; the default stays `"max"`.
- **DAL**: an existing or new unit test that each start-delivery check throws `ParcelOperationError` with the expected code and the unchanged message.
- **Integration** (`tests/integration/mobile-rider-start-delivery.integration.test.ts`): seed two riders. Rider A starts two of their own `at_office` parcels: both are `on_the_way`, with one pending `delivery_attempt` payout each. A batch with A's `at_office` parcel and B's parcel is a 404, and neither parcel changes. A parcel already `on_the_way` is a 409. `next/cache` is mocked (real exports spread) because there's no Next request context in Bun.
- **Cleanup test**: "converts the DAL's string counts" in `tests/unit/mobile-rider-parcels.unit.test.ts` becomes "passes the DAL's numeric counts through", with numbers in and the same numbers out.
- **App Jest**: `apiPost` (JSON body, headers, envelope, 401 sign-out). List screen: the start button and checkbox only on `at_office` cards; a single start posts one ID and refetches; the bar shows count and total; two selected → `Alert.alert` (mocked), Cancel posts nothing and Start posts both; the error notice; selection cleared on tab switch. Detail screen: the button only for `at_office`, success refetches, 409 shows the message.

## Risks / Trade-offs

- [Web behaviour drift] Moving the action's body could change what the web sees → the action unit test pins every message, and the web component test (`tests/components/rider-parcel-card-list.component.test.tsx`) still mocks the action at its export, so it's unaffected.
- [50-parcel cap applies to the web too] → the web selects from a 12-card page, so no rider can reach it there; the cap stops an unbounded `IN (…)` from the API.
- [`{ expire: 0 }` costs a blocking read] The next rider list read after a start is a cache miss → that's one query per start, and freshness is the point of the write.
- [Retry shows a 409 message for a start that worked] → the refetch shows the correct status; real idempotency waits for the offline queue.
- [Selection only covers loaded pages] A rider can only select parcels they've scrolled to → that's what they can see; "select all" isn't in scope.

## Migration Plan

No database changes. The server action keeps its contract, and the route and app UI are additive. Rollback is reverting the change; the web keeps working because the action's behaviour is unchanged either way.
