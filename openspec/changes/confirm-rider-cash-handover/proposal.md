## Why

Riders can mark parcels delivered before the office physically receives the collected cash, so creating a COD merchant-remittance item at delivery time makes settlement work eligible too early. Admins need a rider cash handover workflow so COD remittance only becomes ready after office receipt is confirmed, while the existing delivery and rider payout behavior stays intact.

## What Changes

- Add an admin dashboard tab named `Rider Cash Handover` alongside the existing settlement workspace flow.
- Show riders who have delivered parcels with pending office handover, including both COD and non-COD parcels because riders still collect delivery fees for non-COD deliveries.
- Add a `Confirm Handover` row action that opens a right-side sheet using the same interaction pattern as the merchant settlements flow.
- In the sheet, list the rider's delivered parcels that are still pending office receipt and allow admins to select multiple or all parcels before confirming receipt.
- Mark selected parcels as office-received and persist the related cash handover state so the selected parcels no longer appear as pending handover.
- Create `cod_remit` financial items only when COD parcels are confirmed in rider cash handover, not when the rider first marks the parcel delivered.

## Capabilities

### New Capabilities
- `admin-rider-cash-handover`: Admin review and confirmation flow for rider-delivered parcel cash handovers using pending delivered parcels and office receipt confirmation.

### Modified Capabilities
- `rider-delivery-actions`: Delivered COD parcels defer `cod_remit` financial item creation until office cash handover confirmation.

## Impact

- Affected code will primarily live under `src/features/settlements` and the admin settlements dashboard route so the rider handover flow can reuse the merchant settlements workspace structure.
- Server-side queries and mutations will need to read delivered parcels, confirm office receipt, create deferred COD remit items, and update `parcels.is_received_by_office` consistently.
- The change will adjust the timing of COD financial item generation in the rider delivery flow without adding new dependencies or a new service boundary.
