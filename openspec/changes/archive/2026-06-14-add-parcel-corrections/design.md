## Context

Parcel Flow stores a parcel's current operational state on `parcels` and records status history in `parcel_status_logs`. Several workflows also derive records and fields from status or rider assignment:

- rider delivery completion sets delivered fields and creates pending rider payout eligibility;
- rider cash handover sets `is_received_by_office` and can create pending COD remit financial items;
- merchant settlement reserves and settles `cod_remit` and `delivery_fee_deduction` items;
- return completion sets `returned_to_merchant` and creates pending delivery fee deduction items;
- rider payout records are modeled but not fully implemented yet, while `financial_items.rider_payout_id` already exists.

The correction workflow must treat `parcels` plus related financial items as one consistency boundary. A correction should either update all affected state in one transaction or reject the request with an explanation.

## Goals / Non-Goals

**Goals:**

- Let super admins and office admins correct a wrong parcel status.
- Let super admins and office admins correct a wrong assigned rider.
- Record a durable correction audit log separate from normal status logs.
- Preserve `parcel_status_logs` as the chronological status history.
- Reconcile side effects for corrections involving delivered, returned, postponed, canceled-returned, and on-the-way states.
- Protect settled or externally finalized money movement from silent mutation.
- Surface correction controls from the parcel detail sheet without adding a separate management page.

**Non-Goals:**

- No merchant settlement reversal workflow.
- No rider payout reversal workflow.
- No correction of merchant, township, COD amount, delivery fee, parcel type, or parcel content fields.
- No bulk correction flow.
- No separate backend service or scheduled repair job.

## Decisions

### Add `parcel_correction_logs`

Create a new `parcel_correction_logs` table instead of overloading `parcel_status_logs`.

Suggested columns:

- `id uuid primary key`
- `parcel_id uuid not null references parcels(id)`
- `correction_type text not null` with values `status` and `rider`
- `old_status text`
- `new_status text`
- `old_rider_id uuid references riders(id)`
- `new_rider_id uuid references riders(id)`
- `status_log_id uuid references parcel_status_logs(id)` for status corrections that also write a status log
- `reason text not null`
- `side_effects jsonb not null default '{}'::jsonb`
- `created_by uuid references user(id)`
- `created_at timestamp with time zone not null default now()`

Rationale: normal status history answers "what status changed?", while correction history must answer "what was corrected, why, by whom, and what related records were changed?" Keeping those concerns separate makes audits clearer.

Log ownership rules:

- `parcel_status_logs` stores every parcel status transition, whether it comes from normal workflow or admin correction.
- `parcel_correction_logs` stores only explicit admin correction events.
- A status correction writes both tables and links the correction log to the status log when possible.
- A rider-only correction writes only `parcel_correction_logs` unless the implementation also changes parcel status as part of the same correction.

### Use one parcel feature correction service

Add feature-local DAL functions under `src/features/parcels/server/dal.ts` for `correctParcelStatus` and `correctParcelRider`, called by Zod-validated server actions in `src/features/parcels/server/actions.ts`.

Each correction must:

- authorize only `super_admin` and `office_admin`;
- load the parcel and related financial items inside a transaction;
- validate the requested target state;
- detect blocking financial states;
- update parcel fields;
- update or void eligible pending financial items;
- write `parcel_status_logs` when status changes;
- write `parcel_correction_logs` with a structured side-effect summary;
- revalidate admin, rider, merchant, settlement, and dashboard views affected by the change.

### Block finalized money before mutating operational history

Corrections that affect merchant settlement or rider payout side effects must reject if any related item is `settled`, linked to a settled settlement, linked to a settled payout, or otherwise externally finalized.

Pending unlinked items may be voided or updated. In-progress settlement items must block correction for MVP to avoid settlement drift.

Rationale: an operational correction is not the same as reversing money already promised or paid. A later reversal capability can explicitly handle accounting adjustments.

### Status correction side-effect policy

Treat status correction as replacing the parcel's current lifecycle state with the selected target status.

The side-effect policy is target-state driven. `delivered` and `returned_to_merchant` need explicit "away from" rules because they are the statuses that create or unlock financial items. The other statuses still need correction behavior, but their behavior is mostly defined by the target state: clear later lifecycle fields, enforce rider assignment rules, and avoid creating financial items.

When correcting away from `delivered`:

- clear `delivered_at`, `collected_at`, and `collected_amount`;
- set `cod_status` to `pending` for COD parcels and `not_applicable` for non-COD parcels;
- set `delivery_fee_status` to `pending`;
- set `is_received_by_office` to `false`;
- clear `collection_confirmed_by`;
- clear `proof_of_delivery_images_keys`;
- void eligible pending `rider_way_payout` items for the parcel;
- void eligible pending `cod_remit` items for the parcel;
- set `merchant_settlement_status` and `rider_payout_status` back to `pending` unless no eligible future financial work remains.

When correcting to `delivered`:

- require an assigned active rider;
- require proof handling to either preserve existing proof keys or require a new proof image/key;
- set `delivered_at`, `collected_at`, collected amount, COD status, delivery fee status, and `is_received_by_office = false`;
- create or restore only the currently implemented delivered side effects, avoiding duplicate active financial items.

When correcting away from `returned_to_merchant`:

- clear `returned_to_merchant_at`;
- set `delivery_fee_status` back to `pending`;
- void eligible pending `delivery_fee_deduction` items for the parcel;
- set `merchant_settlement_status` back to `pending`.

When correcting to `returned_to_merchant`:

- require the parcel to be or become assigned to an active rider if rider attribution is needed;
- set `returned_to_merchant_at`;
- set `delivery_fee_status = deduct_from_merchant`;
- create one pending `delivery_fee_deduction` item if no active item exists.

When correcting to `postpone` or `canceled_returned`:

- clear active delivery state;
- clear current rider assignment unless the target is `canceled_returned` and the admin explicitly keeps or selects a rider for return handling;
- deactivate any active failure note if the correction resolves a failed delivery;
- do not create financial items.

When correcting away from `at_office`, `on_the_way`, `postpone`, or `canceled_returned`:

- do not assume those source statuses created financial items;
- apply the selected target state's required fields and side effects;
- clear active failure notes only when the correction resolves or replaces the failed-delivery decision;
- block the correction if stale related financial items exist in in-progress or settled states;
- void stale pending financial items only when they are inconsistent with the target state and safe to void.

When correcting to `at_office`:

- clear delivery, return, collection, handover, and proof fields;
- clear rider assignment by default;
- void eligible pending financial items created by later lifecycle states.

When correcting to `on_the_way`:

- require an assigned active rider;
- clear delivered/returned timestamps and collection confirmation;
- void eligible pending financial items created by delivered or returned states;
- keep `assigned_at` or set it when a new rider is selected.

### Rider correction side-effect policy

Rider correction changes only the assigned rider and rider-owned pending side effects.

Rules:

- The target rider must exist, be active, and optionally serve the parcel township if the current assignment rules require that.
- Unassigned correction is allowed for statuses that can safely sit unassigned: `at_office`, `postpone`, and `canceled_returned`.
- `on_the_way` and `delivered` require a rider after correction.
- For active collection statuses, update `parcels.rider_id` and `assigned_at`.
- For delivered parcels, update eligible pending `rider_way_payout` items to the new rider.
- Block rider correction if a related rider payout item is already attached to an in-progress or settled payout.
- Do not change merchant settlement items when only the rider changes, except for COD remit rows whose rider attribution is purely historical and remains nullable.

### UI placement

Use the existing parcel detail sheet as the entry point. This is the preferred placement because correction is a high-risk per-parcel action that requires the operator to review the parcel's current status, rider, merchant, financial state, and history before submitting.

Add a `Corrections` section visible only to `super_admin` and `office_admin`:

- `Correct Status` button opens a dialog with current status, target status select, optional rider/proof fields when required, reason textarea, and a preview of side effects.
- `Correct Rider` button opens a dialog with current rider, target rider select or unassign option when allowed, reason textarea, and side-effect warning.
- The section lists recent correction logs with actor, timestamp, type, before/after values, reason, and concise side-effect summary.

Use shadcn/ui dialog, select, textarea, alert, button, and form patterns. The UI must not be the authority for correction eligibility; server actions return stale-state errors.

Alternatives considered:

- Put correction buttons in the parcel table row. This is faster but increases accidental-action risk and lacks enough context for side-effect review.
- Add a separate correction center page. This may be useful later for approvals or audit reporting, but it is unnecessary for the first correction workflow and would split parcel context away from the action.

## Risks / Trade-offs

- Correction matrix complexity -> Implement explicit status-target handlers and integration tests instead of generic field patching.
- Existing specs disagree on exactly when COD remit is created -> Reconcile against the current implemented cash handover source of truth and document behavior in tests.
- Blocking in-progress settlement cases may frustrate admins -> Safer for MVP than recalculating existing settlement drafts silently.
- Proof image cleanup can be lossy -> Clear parcel references during correction, but object deletion can be best-effort or deferred unless existing upload utilities already support deterministic cleanup.
- Race conditions between corrections and settlement/handover actions -> Use transactions and conditional updates against current status, rider, and financial item state.
