## Context

The rider parcel card view already supports rider-scoped parcel listing, filtering, selection, detail sheets, and `Start Delivery` mutations. `Report Failure` and `Mark Delivered` are currently visible on expanded `on_the_way` cards but intentionally do not mutate data.

The product spec defines two distinct rider delivery outcomes:

- Failure reporting stores `parcels.delivery_failure_note` while leaving the parcel `on_the_way` for admin review.
- Successful delivery changes the parcel to `delivered`, records proof and collection values, and creates the financial items used by merchant settlement and rider payout.

The database docs include `delivery_failure_note` and `proof_of_delivery_images_keys`, but the current Drizzle schema only includes proof image keys. The implementation must add or confirm the physical failure-note column before wiring the server action.

## Goals / Non-Goals

**Goals:**

- Implement rider-only actions for assigned `on_the_way` parcels.
- Keep all authorization, ownership, state transition, and financial side effects on the server.
- Use shadcn dialogs from the rider card list for both actions.
- Support a mobile camera-first proof capture flow for delivery confirmation.
- Store only object storage keys for proof images.
- Make delivered-parcel mutations transactional so parcel fields and financial items cannot diverge.

**Non-Goals:**

- Admin review flows for failed delivery notes.
- Admin status updates to `postpone`, `canceled_returned`, or `returned_to_merchant`.
- Merchant settlement draft creation or rider payout draft creation.
- Multi-image proof management beyond the delivery confirmation upload required for this flow.
- New backend services or a separate upload service.

## Decisions

### Use feature-local server actions and DAL mutations

Add `reportDeliveryFailureForRiderParcelAction` and `markRiderParcelDeliveredAction` in `src/features/parcels/server/actions.ts`, backed by rider-scoped DAL functions in `src/features/parcels/server/dal.ts`.

Rationale: This matches the existing `startDeliveryForRiderParcelsAction` path and keeps parcel business logic inside the parcel feature. The server action validates form inputs and current user role; the DAL enforces rider profile lookup, active user status, parcel ownership, parcel status, and transactional updates.

Alternative considered: Put delivery actions in a separate rider feature. That would split parcel status and financial side effects away from the existing parcel DAL and make future status consistency harder to audit.

### Treat failure reporting as a note-only mutation

Reporting failure requires a non-empty note and writes it to `parcels.delivery_failure_note`. The same dialog is used to view and edit an existing note. Deleting a note clears `parcels.delivery_failure_note`. These note mutations must not change status, clear rider assignment, set timestamps, update collection fields, or create financial items.

When an `on_the_way` parcel already has a failure note, the card should show only the failure-note management action for delivery outcomes. It should hide `Report Failure` and `Mark Delivered` until the note is deleted.

Rationale: The product flow requires admin review before deciding whether a failed delivery becomes postponed or canceled/returned.

Alternative considered: Move the parcel to a new `failed` status. The domain model intentionally avoids that status; the note is the signal for admin review while the parcel remains `on_the_way`.

### Treat delivery confirmation as one transactional domain mutation

Mark delivered must update the parcel and insert financial items in the same database transaction:

- `status = delivered`
- `delivered_at` and `collected_at` set
- `collected_amount` set to `cod_amount + delivery_fee` for COD parcels, or `delivery_fee` for non-COD parcels
- `cod_status = collected` for COD parcels, or `not_applicable` for non-COD parcels
- `delivery_fee_status = collected`
- `is_received_by_office = false`
- `merchant_settlement_status = pending`
- `rider_payout_status = pending`
- `proof_of_delivery_images_keys` stores uploaded proof keys
- COD parcels create one pending `cod_remit` financial item
- All delivered parcels create one pending `rider_way_payout` financial item with amount `1`

Rationale: Parcel delivery completion is the source event for both cash tracking and payout eligibility. Partial success would create reconciliation bugs.

Alternative considered: Create financial items in a follow-up action after delivery. That would make delivered parcels temporarily inconsistent and require repair jobs or manual cleanup.

### Upload proof through the delivery dialog submit path

The delivery confirmation dialog should submit multipart form data containing the parcel id and proof photo. The file input should use `accept="image/*"` and `capture="environment"` so mobile browsers can open the rear camera directly. After capture, the selected image preview appears in the dialog before submit.

Rationale: This gives riders a camera-first mobile flow without requiring a separate camera integration or native app. Desktop still supports normal image file selection.

Alternative considered: Pre-upload images before the domain mutation. That improves perceived speed but adds orphan-file cleanup complexity if the rider cancels or the final server mutation fails.

### Store object keys, not URLs

Delivery proof upload should use the existing Cloudflare R2 convention from the technical services doc and persist keys like `parcels/{parcel_id}/proof-of-delivery/{file_name}` in `proof_of_delivery_images_keys`.

Rationale: The docs state that object keys are the database source of truth and signed/public URL handling should remain separate from parcel state.

Alternative considered: Store public URLs directly in the parcel. That couples the database to a public delivery domain and makes later private access controls harder.

## Risks / Trade-offs

- Mobile `capture` behavior varies by browser and OS -> Use it as a progressive enhancement, while keeping normal file selection and preview available.
- Uploading the proof inside the server action can leave an uploaded object if the database transaction fails after upload -> Upload before the transaction, then only persist the key after validation; if DB persistence fails, attempt best-effort object deletion or make object keys deterministic enough for later cleanup.
- Duplicate submission can create duplicate financial items -> Disable pending buttons client-side and have the DAL reject parcels that are no longer `on_the_way`; optionally check for existing active financial items for the parcel before inserting.
- Large image uploads can slow mobile submissions -> Validate file type and size server-side, and keep the UI to one required proof image for this change.
- The failure-note column may be missing in deployed databases -> Add a Drizzle schema field and migration before enabling the action.
