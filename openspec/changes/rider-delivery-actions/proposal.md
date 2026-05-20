## Why

The rider parcel card view now exposes `Report Failure` and `Mark Delivered`, but those actions are intentionally deferred and do not yet persist delivery outcomes. Riders need a mobile-friendly way to complete delivery work from the card view while the system applies the required parcel status, collection, proof, and financial side effects consistently on the server.

## What Changes

- Add a rider `Report Failure` flow from assigned `on_the_way` parcel cards.
- Show a shadcn dialog for failure reporting with a required note textarea.
- Persist the failure note to `parcels.delivery_failure_note` without changing parcel status or creating financial records.
- Add a rider `Mark Delivered` flow from assigned `on_the_way` parcel cards.
- Show a shadcn dialog for delivery confirmation with collection amount display and delivery proof photo upload.
- Optimize the delivery proof upload for mobile so tapping the upload control can open the phone camera and attach the captured photo directly.
- Persist delivery proof image storage keys to the parcel.
- Mark the parcel delivered and update collection/payment status fields.
- Generate merchant settlement and rider payout `financial_items` according to parcel type and delivery rules.
- Keep authorization, ownership checks, validation, status transition checks, and financial side effects in server-side parcel logic.

## Capabilities

### New Capabilities
- `rider-delivery-actions`: Rider-facing delivery failure reporting and successful delivery completion from assigned parcel cards.

### Modified Capabilities

## Impact

- Affects the rider parcel card client UI under `src/features/parcels/components`.
- Adds or updates parcel server actions, rider-scoped DAL mutations, DTO fields, validation schemas, and path revalidation under `src/features/parcels/server`.
- Adds or confirms database schema and Drizzle migration support for `parcels.delivery_failure_note` and delivery proof image key storage.
- Uses existing shadcn dialog/form/button/textarea patterns and existing object storage conventions for parcel images.
- Touches financial item generation for delivered parcels, including COD merchant settlement items and rider way payout items.
