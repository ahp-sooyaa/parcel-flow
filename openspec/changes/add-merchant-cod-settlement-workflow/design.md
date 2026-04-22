## Context

Merchant detail already shows parcel stats and a merchant-scoped parcel table. Parcel payment records already track COD, collection, delivery fee, merchant settlement, and rider payout statuses, but there is no settlement table or server workflow that locks selected COD parcels while staff prepare a bank remittance to the merchant.

This change adds a money-sensitive workflow inside the existing Next.js monolith. It must stay feature-sliced, use server actions for mutations, validate with zod, put database access in DAL files, and shape responses with DTOs. COD remains merchant money, not company revenue.

Stakeholders:
- Super admins who can perform and correct settlement workflows.
- Office/finance operators who may be granted settlement permissions under the existing role and permission model.
- Merchants whose delivered COD parcels are being settled.
- Operations staff who need the parcel list to remain clear about which COD funds are still held.

## Goals / Non-Goals

**Goals:**
- Add settlement mode to merchant detail, triggered from the `COD in Held` stat.
- Show only eligible parcels in settlement mode: delivered, COD collected, and not locked or settled.
- Generate pending settlements from selected parcels with immutable item-level financial snapshots.
- Lock selected parcel payment records so another active settlement cannot include the same parcel.
- Confirm external payment with a required payment slip image and reference number.
- Record maker/checker fields and timestamps for settlement creation and payment confirmation.
- Allow pending settlements to be cancelled or rejected and release their parcel locks.
- Prevent paid settlement totals from being changed by later parcel edits.

**Non-Goals:**
- Adding public merchant payout portals.
- Adding a new `finance` application role in this iteration. Finance access is represented by explicit settlement permissions assigned within the existing role model.
- Automating bank transfers or integrating bank APIs.
- Treating COD as revenue or changing delivery-fee accounting beyond settlement deduction snapshots.
- Implementing rider payout settlement in this change.

## Decisions

### Decision: Add a `merchant-settlements` feature slice
Settlement-specific UI and server code will live under `src/features/merchant-settlements/*`, with the required `components`, `server/actions.ts`, `server/dal.ts`, `server/dto.ts`, and `server/utils.ts` structure. Merchant detail will compose this feature instead of placing settlement business logic in `src/features/merchant`.

Rationale:
- Settlement is a distinct accounting workflow with its own DAL, DTOs, validation, and permissions.
- Keeping it separate avoids turning merchant profile code into a mixed profile/accounting module.

Alternatives considered:
- Put settlement logic inside `src/features/merchant`.
- Rejected because settlements have their own lifecycle, audit rules, and schema.

### Decision: Use settlement records for audit and payment-record lock fields for active state
The schema will add `merchant_settlements` and `merchant_settlement_items`. Settlement items store immutable snapshots of COD amount, delivery fee, fee deduction state, and net payable amount. Parcel payment records will also gain a nullable active settlement reference, such as `merchant_settlement_id`, while continuing to use `merchant_settlement_status` for `pending`, `in_progress`, and `settled`.

On generation, a transaction creates the settlement, creates settlement items, sets each selected payment record's active settlement reference, and moves merchant settlement status to `in_progress`. On payment confirmation, the settlement becomes `paid` and the linked payment records become `settled`. On cancellation or rejection, the settlement is marked terminal, payment records clear the active settlement reference, and their merchant settlement status returns to `pending`.

Rationale:
- Historical settlement items remain available for audit even when a pending settlement is cancelled.
- Active lock state remains easy to query and enforce for the available-to-settle list.
- The existing payment-record status vocabulary can continue to drive parcel list filtering.

Alternatives considered:
- Use settlement items alone as the lock.
- Rejected because cancelled/rejected settlements would either keep parcels locked forever or require deleting snapshot rows.
- Use only payment-record fields without item snapshots.
- Rejected because it would not preserve the financial state used to calculate a settlement.

### Decision: Enforce no-overlap in the generation transaction
Settlement generation will re-read selected payment records inside a transaction and require every row to match the eligible state: same merchant, parcel delivered, parcel type COD, COD status collected, merchant settlement status pending, and no active settlement reference. The update that locks rows must include those same predicates and verify the affected row count equals the selected count.

Rationale:
- UI filtering is helpful but cannot be trusted.
- Concurrent admins can select the same parcels, so locking must be server-side and transactional.

Alternatives considered:
- Depend on client-side filtering and disabled controls.
- Rejected because it does not prevent double-payment under concurrency.

### Decision: Snapshot net payable explicitly
Each settlement item will store `snapshot_cod_amount`, `snapshot_delivery_fee`, `is_delivery_fee_deducted`, and `net_payable_amount`. Net payable is calculated server-side as COD amount minus delivery fee only when the payment record's delivery fee status is `deduct_from_settlement`; otherwise it equals the COD amount.

Rationale:
- Auditors can see exactly why the paid amount differs from raw COD.
- Later parcel edits do not change the generated settlement total.

Alternatives considered:
- Recompute totals from current parcel data whenever settlement detail is viewed.
- Rejected because parcel data can change and paid settlement totals must be immutable.

### Decision: Treat settlement confirmation as checker-only
Generation and confirmation will be separate server actions. `created_by` records the maker. `confirmed_by` records the checker when the settlement moves to `paid`. The confirmation action requires an authorized actor, a reference number, and a validated image upload for the payment slip.

Rationale:
- The workflow remains auditable even if the first implementation does not force two different people.
- Authorization can later add stricter separation-of-duty rules without changing the core data model.

Alternatives considered:
- Use a single action that creates and marks a settlement paid.
- Rejected because it collapses the maker/checker audit trail and hides external bank-transfer review.

### Decision: Do not introduce a finance role
The current authorization spec defines exactly four roles. This change will add settlement permissions such as `merchant-settlement.view`, `merchant-settlement.create`, `merchant-settlement.confirm`, and `merchant-settlement.cancel`. Super admins receive all permissions. Office admins may receive the view/create/cancel permissions by default if the seed policy chooses, while confirmation can remain super-admin-only until a finance role is formally introduced.

Rationale:
- Respects the existing role model while enabling permission-based finance behavior.
- Avoids broad role changes for one workflow.

Alternatives considered:
- Add a `finance` role now.
- Rejected because it changes a foundation requirement outside the requested settlement workflow.

## Risks / Trade-offs

- [Risk] Concurrent generation attempts could still race if the lock update is too broad. -> Mitigation: use a transaction, predicate-based update, and affected-row count checks before committing.
- [Risk] Settlement status names differ between settlement records (`paid`) and payment records (`settled`). -> Mitigation: keep mapping explicit in server utils and DTOs.
- [Risk] Payment slip uploads could expose unsafe files. -> Mitigation: validate MIME type and size on the server and store only safe object keys/URLs in settlement DTOs.
- [Risk] Merchant detail could become too dense. -> Mitigation: keep settlement mode and settlement history as distinct views/tabs within the existing merchant detail experience.
- [Risk] Paid-settlement immutability could block legitimate parcel corrections. -> Mitigation: reject direct edits that alter settled financial totals and require a later explicit adjustment workflow if needed.

## Migration Plan

1. Add Drizzle schema definitions for settlement tables, status constants, item snapshots, active payment-record settlement reference, indexes, and constraints.
2. Run Drizzle generate and migrate from the schema changes; do not hand-write migration SQL.
3. Add settlement permission constants and update auth seed verification.
4. Add the merchant-settlements feature slice with DAL, DTOs, utils, server actions, and components.
5. Integrate settlement mode and settlement history into merchant detail.
6. Update parcel update validation to reject financial edits for paid or actively locked settlements.
7. Add targeted tests for eligibility, generation locking, cancellation release, paid confirmation, upload validation, authorization, and paid-state immutability.

Rollback strategy:
- If the feature must be disabled before data is used, remove route entry points and permission mappings while leaving unused tables in place.
- After real settlement data exists, rollback must preserve settlement tables and only disable actions/UI until a data-safe migration plan is prepared.

## Open Questions

- Should office admins receive `merchant-settlement.confirm` by default, or should paid confirmation remain super-admin-only until a dedicated finance permission policy is finalized? Answer: super-admin-only can confirm paid, office admin can generate settlement but final actual payment transfer and confirm by super admin
- What maximum payment slip image size should be enforced for production uploads? Answer: let keep as small as possible, may be 1MB
