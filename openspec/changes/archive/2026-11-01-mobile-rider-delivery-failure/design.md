## Context

Overall context and roadmap: `docs/mobile-app.md`. This is slice 6 of 9. Slices 4 and 5 set up the shared rider operation layer (`src/features/parcels/server/rider-operations.ts`), `ParcelOperationError`, `toFailure()`, and the route-safe cache invalidation this slice reuses.

What already exists:

- **Storage**: `parcels.delivery_failure_note` is a JSONB array of `{ note, status: "active" | "inactive" }` (`src/features/parcels/server/failure-notes.ts`). At most one entry is active. Admin resolution (postpone or return) marks it inactive; it then stays as history.
- **Web server actions** in `src/features/parcels/server/actions.ts`, called by the rider card's failure dialog (`src/features/parcels/components/rider-parcel-card-list.tsx`):
  - `reportDeliveryFailureForRiderParcelAction({ parcelId, note })` → "Delivery failure reported."
  - `updateDeliveryFailureForRiderParcelAction({ parcelId, note })` → "Delivery failure note updated."
  - `deleteDeliveryFailureForRiderParcelAction({ parcelId })` → "Delivery failure note deleted."

  Each one: `requireCurrentUser()`, validates with Zod after `normalizeFormInput` (`parcelId` UUID, `note` trimmed, 1 to `TEXT_LIMITS.note` = 500 characters), rejects non-riders, calls the DAL, returns any thrown message, then `revalidateParcelOperationalPaths({ caller: "server-action" })` without `riderUserId`.

- **DAL** `reportDeliveryFailureForRiderParcel`, `updateDeliveryFailureForRiderParcel`, `deleteDeliveryFailureForRiderParcel`, each in a transaction:
  - checks the actor is a rider, then an active rider profile
  - reads the parcel (report and update lock it `FOR UPDATE`; **delete does not**)
  - checks it exists, is the rider's, and is `on_the_way`
  - report: rejects if a note is already active, then appends an active entry
  - update: replaces the latest active entry's text, or rejects "No active failure note was found for this parcel."
  - delete: removes the latest active entry (the column becomes `null` if nothing is left), or rejects the same way

  All of them throw plain `Error`s.

- **No payout or status side effects**: a failure note leaves the parcel `on_the_way` and its assignment unchanged. `hasUnresolvedFailureReview` (the admin `Need review` queue) is derived from the active note.
- **Demo mode**: failure notes are allowed for the demo rider, with no limiter.
- **Mobile**:
  - The list DTO has `hasActiveFailureNote`, and the detail DTO has `activeFailureNote: string | null`.
  - The detail screen shows the note as a warning `Notice` and hides "Mark delivered" while it's active. The card and slice 5's Mark delivered screen apply the same rule.
  - `apiGet`, `apiPost`, `apiPostForm` share an internal `request()` that only knows `POST`.

## Goals / Non-Goals

**Goals:**

- One rule set for failure notes on the web and in the app.
- Reporting a failure in a few taps at the doorstep, with text an admin can act on.
- A rider who reported by mistake can undo it from the app and then deliver.

**Non-Goals:**

- Photos on failure reports, structured reason codes, past-note history in the app.
- Admin failure resolution (stays on the web).
- Returns to merchant (slice 7).

## Decisions

### Shared operations

In `src/features/parcels/server/rider-operations.ts`:

```ts
export async function reportRiderDeliveryFailure(
  actor: CurrentUser,
  input: unknown, // { parcelId, note }
  options: { caller: ParcelOperationCaller },
): Promise<RiderFailureNoteResult>;

export async function updateRiderDeliveryFailure(actor, input /* { parcelId, note } */, options);
export async function deleteRiderDeliveryFailure(actor, input /* { parcelId } */, options);

type RiderFailureNoteResult =
  | { ok: true; message: string; parcelId: string; activeFailureNote: string | null }
  | RiderOperationFailure;
```

Each one, in the server actions' current order so every web message stays the same:

1. **Validate**: the three schemas move from `actions.ts` unchanged → `invalid`. The note schema is exported as `failureNoteSchema` so the contract test can compare limits.
2. **Authorize**: `actor.role !== "rider"` → `forbidden`, with today's message for each action.
3. **DAL** → `ParcelOperationError` mapped by `toFailure()` (`not_assigned` → `not_found`); other errors → `failed`.
4. **Invalidate**: `revalidateParcelOperationalPaths({ caller: options.caller, riderUserId: actor.id })`. Passing `riderUserId` is new for the web too; it refreshes the rider's own list tags.
5. **Return** the parcel id and the active note after the write: the trimmed note for report and update, `null` for delete. The app uses it to update the detail cache before its refetch lands.

`normalizeFormInput` stays in the server action wrappers, because only the web sends form-shaped input.

### Typed DAL errors and the delete lock

The three DAL functions throw `ParcelOperationError` with unchanged messages:

| Check                             | Code           |
| --------------------------------- | -------------- |
| not a rider, inactive rider       | `forbidden`    |
| missing parcel                    | `not_found`    |
| another rider's parcel            | `not_assigned` |
| not `on_the_way`                  | `conflict`     |
| report: a note is already active  | `conflict`     |
| update and delete: no active note | `conflict`     |

`deleteDeliveryFailureForRiderParcel` adds `.for("update")` to its parcel read. Without it, a delete and a concurrent edit, admin resolution or delivery can both read the same JSONB and the later write silently undoes the earlier one.

The update statements stay guarded by `id` and `riderId`. Under the row lock, the status and note checks above can't go stale before the write, so no extra guard is needed.

### Server actions

The three actions become wrappers like `startDeliveryForRiderParcelsAction`: `requireCurrentUser()`, call the operation with `normalizeFormInput(input)` and `{ caller: "server-action" }`, return `{ ok, message }`. Messages, including validation and DAL messages, are unchanged, so `tests/unit/parcel-actions.unit.test.ts` keeps passing with only its mocks adjusted.

### Mobile endpoints

One route file, `src/app/api/mobile/v1/rider/parcels/[parcelId]/failure-note/route.ts`, for the parcel's one active note:

```text
POST   /api/mobile/v1/rider/parcels/{parcelId}/failure-note   { "note": "..." }   report
PATCH  /api/mobile/v1/rider/parcels/{parcelId}/failure-note   { "note": "..." }   edit
DELETE /api/mobile/v1/rider/parcels/{parcelId}/failure-note                       delete
```

The parcel id is in the path, like `/deliver`. Separate verbs keep "report" from overwriting a note another device just wrote: `POST` only succeeds with no active note, and `PATCH` only with one.

| Result                                                  | Status    | Message                                                                         |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------- |
| Done                                                    | 200       | the operation's message, `data: { parcelId, activeFailureNote }`                |
| Not JSON (`POST`/`PATCH`), bad UUID, empty or long note | 400       | "A valid JSON body is required." or the validation message                      |
| No session / inactive or not a rider                    | 401 / 403 | from `requireMobileRider()`                                                     |
| `not_found` (missing or another rider's)                | 404       | "Parcel not found."                                                             |
| `conflict`                                              | 409       | the operation's message, e.g. "This parcel already has an active failure note." |
| `failed`                                                | 500       | "Unable to save the failure note." (no internal details)                        |

`DELETE` ignores any body. The route calls the operation with `{ parcelId, note: body.note }`, so a `parcelId` in the body can't override the path.

### Contract

```ts
// Mirrors TEXT_LIMITS.note (src/lib/validation.ts); a unit test checks they agree.
export const MOBILE_FAILURE_NOTE_MAX_LENGTH = 500;

export const mobileFailureNoteRequestSchema = z.object({
  note: z.string().trim().min(1).max(MOBILE_FAILURE_NOTE_MAX_LENGTH),
});
export const mobileFailureNoteResultSchema = z.object({
  parcelId: z.string(),
  activeFailureNote: z.string().nullable(),
});
export const mobileFailureNoteResponseSchema = mobileSuccessResponseSchema(
  mobileFailureNoteResultSchema,
);
```

The app validates with the request schema before sending, so an empty or overlong note never makes a round trip. The server still validates on its own.

### App: data layer

- `request()`'s write option widens from `"POST"` to `"POST" | "PATCH" | "DELETE"`, with an optional body. `apiPatch(path, body, schema)` sends JSON like `apiPost`. `apiDelete(path, schema)` sends no body and no `Content-Type`.
- `mobile/src/api/parcels.ts` gains `useReportFailure(parcelId)`, `useUpdateFailureNote(parcelId)` and `useDeleteFailureNote(parcelId)`. On success, each writes the returned `activeFailureNote` and `hasActiveFailureNote` into the cached detail (`setQueryData`), so the detail screen is right the moment the modal closes. On settle, each invalidates `["rider-parcels"]` and that parcel's detail, like slices 4 and 5.

### App: screens

- **Detail screen**, for an `on_the_way` parcel:
  - No active note: a secondary "Report failure" button under "Mark delivered".
  - Active note: the warning `Notice` becomes a "Failure reported" section showing the note, the line "An admin will review this parcel. Delete the note if you can still deliver it.", and a secondary "Edit note" button. "Mark delivered" stays hidden.
  - Both buttons push `/failure/[parcelId]`.
  - Other statuses show neither. An inactive (resolved) note never shows, because the DTO only carries the active one.
- **Card**: an on-the-way parcel with `hasActiveFailureNote` shows a small warning line "Failure reported" where "Mark delivered" sits, so the rider sees why the button is missing. Tapping the card opens the detail as before. Reporting from the card directly isn't offered: it's rarer than delivering, and the detail screen also has the receiver's call link, which riders use first.
- **Failure note screen** (`mobile/src/app/(rider)/failure/[parcelId].tsx`, presented as a modal):
  - Title "Report failure" without an active note, "Edit failure note" with one. It uses `useRiderParcel(parcelId)` and its cached preview, so it opens instantly. Edit mode waits for the detail, which has the note text.
  - Shows the parcel code, receiver name, a tappable phone number (`tel:`), and the address.
  - **Quick reasons**: chips that fill the note when it's empty, or append on a new line when it isn't: "Receiver didn't answer the phone", "Receiver not at the address", "Wrong or incomplete address", "Receiver refused the parcel", "Receiver asked for another day". They are app-side text only; the server stores whatever the rider ends up with, so the web and admins see the same plain note as today.
  - A multiline `TextField` ("Failure note") with a live "123/500" count. Typing past the limit is blocked with `maxLength`.
  - **Save**: "Report failure" or "Save note". Disabled while the trimmed note is empty, and in edit mode while it's unchanged. Busy while saving, and the modal can't be swiped closed during the request (`gestureEnabled: false`).
  - **Delete** (edit mode only): a secondary destructive "Delete note" button. It opens `Alert.alert` ("Delete this failure note?", "Mark delivered will be available again.", Cancel / Delete), then sends `DELETE`.
  - **Success**: the modal closes (`router.back()`) and the detail screen, already updated from the response, shows the new state. A separate success screen like slice 5's isn't needed: the result is visible right away on the screen underneath, and saving a note is a light action.
  - **Errors**: the message shows in a `Notice` and the text is kept, so the rider can retry. A 404 or 409 also refetches, and the screen then shows the parcel's current state.
  - **Not eligible**: if the parcel isn't on the way when the screen opens or after a refetch (delivered, resolved by an admin, reassigned), it shows why and offers no form. If the screen opened in report mode but the refetch finds an active note (reported from another device), it switches to edit mode with that note and says so.

### Idempotency and concurrency

- **Double tap**: the button is busy while the request runs. A second report gets 409 "This parcel already has an active failure note.", and a second delete gets 409 "No active failure note was found for this parcel."
- **Lost response, then retry**: a retried report or delete gets 409, the refetch shows the note (or its absence), and the screen shows the current state. Nothing is written twice.
- **An admin resolves the note while the rider is editing**: the parcel is no longer `on_the_way` or no longer the rider's → 409 or 404, and the screen shows the parcel's current state.
- **Delete racing a delivery or an edit**: the new row lock serialises them.

### Tests

- **Operation unit** (`tests/unit/rider-operations.unit.test.ts`, extended), for each of the three: `invalid` (bad UUID, empty and 501-character note), `forbidden`, success with the returned note and invalidation with `riderUserId` and the given caller, and `ParcelOperationError` codes mapped (`not_assigned` → `not_found`), other errors → `failed`. Mocks spread the real exports.
- **Server action unit** (`tests/unit/parcel-actions.unit.test.ts`): the existing failure tests keep their messages; adjust their mocks to the operation.
- **Mobile route unit** (`tests/unit/mobile-rider-delivery-failure.unit.test.ts`): for each verb, 401, 403, 400 (bad JSON, empty note), 404, 409, 500 with hidden details, and a 200 that parses with the contract. A body `parcelId` doesn't override the path. The contract's note limit equals `TEXT_LIMITS.note`.
- **Integration** (`tests/integration/mobile-rider-delivery-failure.integration.test.ts`), real DAL and database:
  - Rider A reports on their on-the-way parcel → 200, an active entry with the trimmed note, status and assignment unchanged, no delivered or payout changes.
  - A second report → 409; edit → the same entry's text changes; delete → no active entry, and the parcel can then be marked delivered through the operation (upload mocked).
  - Delete on a parcel with an inactive history entry plus an active one keeps the inactive entry.
  - Rider B on Rider A's parcel → 404 for all three; an at-office parcel → 409; `PATCH`/`DELETE` without an active note → 409.
  - The DAL called directly throws the expected `ParcelOperationError` codes.
- **App Jest**:
  - `apiPatch` and `apiDelete`: method, body, headers and the envelope.
  - Detail screen: "Report failure" only for on-the-way parcels without a note; the "Failure reported" section with "Edit note" with one; neither for other statuses.
  - Card: "Failure reported" instead of "Mark delivered" for a parcel with a note.
  - Failure note screen:
    - save disabled when empty, and when unchanged in edit mode
    - a quick reason fills an empty note and appends to a non-empty one
    - the count, and report posting the trimmed note
    - edit sending `PATCH`, and delete confirming through a mocked `Alert.alert` then sending `DELETE`
    - closing on success, a 409 kept with the text
    - the not-eligible state, and the switch to edit mode when a note already exists

## Risks / Trade-offs

- [Quick reasons are English only] Riders may prefer Burmese → they are plain text the rider can edit, and Burmese localisation is in "Later Ideas". Admins read whatever the rider saves.
- [No structured reason code] Reports can't be grouped by reason → the stored shape stays as is, so the web and admin flows don't change; a reason field can be added later without breaking the app, since the API returns only the text.
- [`riderUserId` invalidation on the web] One more cache tag expired per web failure action → it's the rider's own tag, and it makes their tab counts correct.
- [Delete now waits on the row lock] A delete may wait briefly behind a concurrent write → the same as report and edit already do.

## Migration Plan

No database changes. The web actions keep their contract, and the mobile route and screens are additive. Rollback is reverting the change; notes written from the app in the meantime are ordinary entries the web already shows.
