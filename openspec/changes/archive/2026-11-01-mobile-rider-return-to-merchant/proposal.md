## Why

When an admin resolves a failed delivery as a return, the parcel becomes `canceled_returned` and stays assigned to a rider, who takes it back to the merchant. Riders can see these parcels in the app's To deliver tab, but they can't finish the return there. They have to open the web page. The app also gets these parcels wrong: the card shows an amount to collect and the status "Canceled", but there's nothing to collect, and the rider has no merchant address or phone number to go to. This slice adds return completion to the app. See `docs/mobile-app.md`; this is slice 7 of 9.

## What Changes

- **Shared operation**: move the body of `markRiderParcelReturnedToMerchantAction` into `returnRiderParcelToMerchant()` in `src/features/parcels/server/rider-operations.ts`. The server action becomes a thin wrapper with unchanged messages.
- **Typed DAL errors**: `markRiderParcelReturnedToMerchant` throws `ParcelOperationError` with unchanged messages, like the other rider writes.
- **Server**: `POST /api/mobile/v1/rider/parcels/{parcelId}/return`, with no body. Responses follow the mobile envelope: 200, 401, 403, 404, 409 and 500.
- **Contract**:
  - List items gain `merchantName`, so a return card can say who it goes back to.
  - The detail gains `merchantReturnContact` (`{ address, phoneNumber }`), set only while the parcel is `canceled_returned`, so the rider can find and call the merchant.
  - Both fields are additive; current app builds ignore them.
- **App**:
  - Return cards show "Return to <merchant>" instead of an amount to collect, plus a "Mark returned" button.
  - The detail screen of a return shows a "Return to merchant" section with the shop name, address, a tappable phone number and "Mark returned", and no collection amounts.
  - Both buttons ask for confirmation first, because the action can't be undone from the app and it creates the merchant's delivery-fee deduction.
  - After the return, the parcel moves to the Returned tab.
- **Docs**: roadmap status in `docs/mobile-app.md`.

## Capabilities

### New Capabilities

- `mobile-rider-return-to-merchant`: complete an assigned `canceled_returned` parcel's return to its merchant, through the mobile API and in the native app.

### Modified Capabilities

- `canceled-parcel-return-completion`: the web rider page and the mobile app share one return-completion operation.
- `mobile-rider-parcel-list`: list items include the merchant name, the detail includes the merchant's return contact for a return parcel, and return parcels show their merchant instead of an amount to collect.

## Impact

- `src/features/parcels/server/rider-operations.ts` gains `returnRiderParcelToMerchant()`. `src/features/parcels/server/actions.ts` delegates to it. The DAL's `markRiderParcelReturnedToMerchant` throws `ParcelOperationError`, and a new `getMerchantReturnContact(merchantId)` reads the shop's address and its user's phone number.
- New route `src/app/api/mobile/v1/rider/parcels/[parcelId]/return/route.ts`. The detail route adds the contact for return parcels.
- `mobile/` gains a `useReturnToMerchant` mutation and changes to the parcel card, list and detail screens. No new packages.
- The web server action now passes `riderUserId` to cache invalidation, as slice 6 did for failure notes.
- No database changes.
- Out of scope: a proof photo or merchant signature on return, returning several parcels in one action, showing the merchant contact on the web, and the web card's amount to collect for returns.
