## Context

Overall context and roadmap: `docs/mobile-app.md`. This is slice 7 of 9. Slices 4 to 6 set up the shared rider operation layer (`src/features/parcels/server/rider-operations.ts`), `ParcelOperationError`, `toFailure()`, and the route-safe cache invalidation this slice reuses. Slice 6 added shared test fixtures (`tests/fixtures/mobile-rider.ts`, `tests/fixtures/mobile-route-session.ts`) and shared modal pieces (`mobile/src/components/parcel-modal-states.tsx`) to reuse rather than copy, because SonarCloud's gate fails above 3% duplicated new code.

What already exists:

- **How a parcel gets here**: an admin resolves a failed delivery with "return" (`resolveFailedParcelByAdmin`), which sets `canceled_returned` and clears the rider. An admin then assigns a rider for the return trip (it may be a different rider). The parcel shows in that rider's To deliver tab.
- **Web server action** `markRiderParcelReturnedToMerchantAction({ parcelId })`, called by the web card's "Return to Merchant" button with no confirmation:
  1. `requireCurrentUser()`, then validates `parcelId` (UUID).
  2. Rejects non-riders, or riders not allowed `canceled_returned → returned_to_merchant`: "You do not have permission to complete parcel returns.".
  3. Calls the DAL, returns any thrown message ("Unable to complete parcel return." otherwise).
  4. `revalidateParcelOperationalPaths({ caller: "server-action" })`, then "Parcel returned to merchant.".
- **DAL** `markRiderParcelReturnedToMerchant({ parcelId, riderUserId, actorRole, createdBy })`, in one transaction:
  - checks permission, then an active rider ("Active rider profile was not found.")
  - locks the parcel `FOR UPDATE`; checks it exists ("Parcel was not found."), is the rider's ("You can only complete merchant returns for parcels assigned to your rider account."), and is `canceled_returned` ("Only canceled-returned parcels can be completed as returned.")
  - a guarded update sets `returned_to_merchant`, `returnedToMerchantAt`, `deliveryFeeStatus = deduct_from_merchant` and pending settlement and payout statuses; a missed update throws the status message
  - writes the status log, a `delivery_fee_deduction` item for the merchant and a `merchant_return` rider way payout item, then recomputes payout statuses

  All of it throws plain `Error`s.

- **Mobile**:
  - The To deliver tab already lists `canceled_returned` parcels; the Returned tab lists `returned_to_merchant`.
  - The status label for `canceled_returned` is "Canceled" (`parcelStatusLabels`).
  - The card and detail show `amountToCollect` (COD plus fee) for every parcel, including returns. Nothing is collected on a return.
  - The list item has no merchant field; the detail has `merchantName` only.
- **Merchant contact**: `merchants.address` (required) and the merchant's login user (`merchants.userId`, nullable) with `app_users.phone_number`. Neither the web rider card nor any rider DTO exposes them today.

## Goals / Non-Goals

**Goals:**

- One return-completion rule set for the web and the app.
- A rider can see where a return goes, call the merchant, and finish the return from the app.
- No accidental returns from a stray tap, since the app can't undo one.

**Non-Goals:**

- Proof of return (photo or signature).
- Returning several parcels to one merchant in one action.
- Changing the web card (its amount to collect for returns, or adding merchant contact).

## Decisions

### Shared operation

In `src/features/parcels/server/rider-operations.ts`:

```ts
export async function returnRiderParcelToMerchant(
  actor: CurrentUser,
  input: unknown, // { parcelId }
  options: { caller: ParcelOperationCaller },
): Promise<ReturnRiderParcelToMerchantResult>;

type ReturnRiderParcelToMerchantResult =
  | { ok: true; message: "Parcel returned to merchant."; parcelId: string }
  | RiderOperationFailure;
```

In the server action's current order, so web messages stay the same:

1. **Validate**: `{ parcelId: z.uuid("Invalid parcel selection.") }` → `invalid` ("Invalid return completion details." if no issue message).
2. **Authorize**: rider allowed `canceled_returned → returned_to_merchant` → otherwise `forbidden`.
3. **DAL** → `toFailure()` (`not_assigned` → `not_found`); other errors → `failed`.
4. **Invalidate**: `revalidateParcelOperationalPaths({ caller: options.caller, riderUserId: actor.id })`.

The server action becomes `requireCurrentUser()` + the operation with `normalizeFormInput(input)` and `{ caller: "server-action" }`, returning `{ ok, message }`. `resolveFailedParcelInputSchema` stays in `actions.ts` for the admin resolution actions.

### Typed DAL errors

`markRiderParcelReturnedToMerchant` throws `ParcelOperationError` with unchanged messages:

| Check                                          | Code           |
| ---------------------------------------------- | -------------- |
| permission, inactive rider                     | `forbidden`    |
| missing parcel                                 | `not_found`    |
| another rider's parcel                         | `not_assigned` |
| not `canceled_returned`, guarded update missed | `conflict`     |

The transaction, row lock and financial items are unchanged.

### Mobile endpoint

```text
POST /api/mobile/v1/rider/parcels/{parcelId}/return
```

No body; the parcel id is in the path, like `/deliver` and `/failure-note`. Any body is ignored.

| Result                                   | Status    | Message                                                        |
| ---------------------------------------- | --------- | -------------------------------------------------------------- |
| Returned                                 | 200       | "Parcel returned to merchant.", `data: { parcelId }`           |
| Bad UUID                                 | 400       | "Invalid parcel selection."                                    |
| No session / inactive or not a rider     | 401 / 403 | from `requireMobileRider()`                                    |
| `not_found` (missing or another rider's) | 404       | "Parcel not found."                                            |
| `conflict` (not `canceled_returned`)     | 409       | "Only canceled-returned parcels can be completed as returned." |
| `failed`                                 | 500       | "Unable to complete parcel return." (no internal details)      |

### Merchant on the list and the return contact on the detail

- `mobileRiderParcelListItemSchema` gains `merchantName: z.string()`, mapped from `ParcelListItemDto.merchantName`, which the list query already selects. The detail already has it through the list item fields.
- `mobileRiderParcelDetailSchema` gains:

  ```ts
  merchantReturnContact: z.object({
    address: z.string(),
    phoneNumber: z.string().nullable(), // null when the shop has no login user
  }).nullable();
  ```

  The detail route sets it only when the parcel is `canceled_returned`, from a new `getMerchantReturnContact(merchantId)` in the parcels DAL: `merchants.address` plus a left join to the merchant's `app_users.phone_number`. Otherwise it's `null`, and the extra read is skipped.

- Only the assigned rider gets it, because the detail route already returns 404 for anyone else's parcel. Riders of other statuses don't see merchant contact details they don't need.
- Both fields are additive. Zod's default `object` strips unknown keys, so current app builds keep working against the new server.

### App

- **`useReturnToMerchant(parcelId)`**: `apiPost("/rider/parcels/{id}/return", {}, mobileReturnToMerchantResponseSchema)`. On settle it invalidates `["rider-parcels"]` and that parcel's detail, like the other mutations, so the parcel moves to the Returned tab and the counts update.
- **Confirmation**: `confirmReturn(parcel, onConfirm)` in `mobile/src/delivery/return-to-merchant.ts` opens `Alert.alert("Mark PF-… returned?", "Do this after you hand the parcel to <merchant>. It can't be undone in the app.", Cancel / Mark returned)`. The card and the detail both use it.
- **Card** (To deliver tab, `canceled_returned`):
  - The footer shows "Return to" and the merchant name instead of "Amount to collect".
  - A "Mark returned" button under it (busy while that parcel's request runs).
  - The result shows in the list's existing notice ("Parcel returned to merchant." or the error), next to start delivery's.
- **Detail** (`canceled_returned`):
  - A "Return to merchant" section first: shop name, address, the phone number as a `tel:` link (hidden when `null`), and a primary "Mark returned" button.
  - The "Collection" section is hidden, since nothing is collected. The receiver section stays, for reference.
  - On success it shows "Parcel returned to merchant." and, once refetched, the parcel's new "Returned to Merchant" status. A 404 or 409 shows the message, and the refetch shows the current state.
- **Status label**: unchanged ("Canceled"). The card's "Return to" footer and the detail's section make the meaning clear, and the label comes from the server, shared with the web.
- **Complexity**: the list's `renderItem` already decides start, deliver and failure-reported per card. The per-card action props move into a `cardActions(item)` helper in the list screen, so the screen stays under Sonar's cognitive complexity limit of 15.

### Idempotency and concurrency

- **Double tap**: the button is busy while the request runs; a second request gets 409 from the guarded update.
- **Lost response, then retry**: the retry gets 409, the refetch shows the parcel in the Returned tab, and no second set of financial items is written.
- **Admin reassigns the return mid-request**: the DAL's ownership check under the lock returns `not_found` → 404.

### Tests

Reuse slice 6's fixtures (`mockMobileRiderSession`, `seedTwoRiders`, `useMobileRiderTestDb`, `mockMobileRouteSession`) instead of new setup.

- **Operation unit** (`tests/unit/rider-operations.unit.test.ts`): invalid id, forbidden, success with invalidation (caller and `riderUserId`), mapped DAL codes, other errors → `failed`.
- **Server action unit** (`tests/unit/parcel-actions.unit.test.ts`): the existing return test keeps its messages.
- **Mobile route unit** (`tests/unit/mobile-rider-return-to-merchant.unit.test.ts`): 401, 403, 400, 404, 409, 500 with hidden details, and a 200 that parses with the contract.
- **Mapper and detail route unit** (`tests/unit/mobile-rider-parcels.unit.test.ts`): `merchantName` on list items; `merchantReturnContact` set for a return and `null` otherwise, without calling the contact read.
- **Integration** (`tests/integration/mobile-rider-return-to-merchant.integration.test.ts`):
  - Rider A returns their `canceled_returned` parcel → 200, `returned_to_merchant` with `returnedToMerchantAt`, one `delivery_fee_deduction` and one `merchant_return` way item.
  - A second request → 409 with no extra items.
  - Rider B's parcel → 404; an on-the-way parcel → 409; both unchanged.
  - The detail of a return includes the merchant's address and phone number; an on-the-way parcel's is `null`.
  - The DAL throws the expected `ParcelOperationError` codes.
- **App Jest**:
  - Card: a return shows "Return to" with the merchant and "Mark returned", and no amount to collect; confirming posts, cancelling doesn't; the success notice.
  - Detail: the return section with address, phone link and "Mark returned"; no collection section; a missing phone number is hidden; a 409 shows the message.
  - Other statuses show no return controls.

## Risks / Trade-offs

- [Merchant phone shown to riders] A return rider sees the merchant's login phone number → only for parcels they're assigned to return, which they need in order to deliver them; admins already share it by phone today.
- [No proof of return] A rider could mark a return without handing it over → the same as the web today; a photo can be added later, reusing slice 5's capture.
- [List DTO grows] One more string per list item → small, and it removes a detail fetch to show the merchant on a card.
- [Status label "Canceled"] It may still read oddly → the card and detail explain the next step; renaming the shared label would change the web too.

## Migration Plan

No database changes. The web action keeps its contract; the mobile route, fields and screens are additive. Rollback is reverting the change. Returns completed in the meantime are ordinary `returned_to_merchant` parcels with the same financial items as the web creates.
