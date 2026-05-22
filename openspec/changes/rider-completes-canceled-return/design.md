## Context

The current parcel workflow already allows admins to resolve failed deliveries into `canceled_returned`, reassign those parcels to riders, and show them in the rider `To Deliver` tab as return work. The gap is at completion time: rider permissions, rider action UI, and the main product spec still treat `returned_to_merchant` as an admin-only transition even though the rider is the actor physically handling the return. Once the rider completes the return, the rider UI also needs a stable place to review that completed work instead of simply removing the parcel from view.

This change stays inside the existing Next.js monolith and parcels feature slice. It must preserve the existing distinction between:

- `canceled_returned`: business decision that the parcel will not be retried and now needs return handling
- `returned_to_merchant`: physical completion of the merchant return

It also must preserve the current financial rule that delivery-fee deduction is created only after the physical return succeeds.

## Goals / Non-Goals

**Goals:**

- Let an active rider complete assigned `canceled_returned` return work from the rider parcel workflow.
- Show completed `returned_to_merchant` parcels in a rider `Returned` tab.
- Update parcel state atomically from `canceled_returned` to `returned_to_merchant`.
- Generate the pending `delivery_fee_deduction` financial item when the return is completed.
- Align product documentation so rider workflow, permissions, and financial side effects describe the same canceled-return flow.

**Non-Goals:**

- Do not change the existing failure-resolution step where admin decides between `postpone` and `canceled_returned`.
- Do not introduce a new parcel status for return-in-progress.
- Do not change rider payout rules from delivered-way counting to return-based counting.
- Do not add a new backend service, queue, or accounting subsystem.
- Do not redesign admin settlement or payout flows beyond the returned-parcel side effect they already consume.

## Decisions

### Add a dedicated rider return-completion path

Treat assigned `canceled_returned` parcels as a separate rider completion path rather than reusing the normal `on_the_way -> delivered` flow. The rider UI should show a completion action for return work, and the server action/DAL should validate the `canceled_returned -> returned_to_merchant` transition specifically.

Why this approach:

- It matches the domain meaning of the statuses instead of pretending return work is normal delivery.
- It avoids leaking return-specific side effects into the standard delivered flow.
- It makes the missing rider action explicit instead of stretching the existing `Mark Delivered` behavior across unrelated status semantics.

Alternative considered:

- Reuse `markRiderParcelDeliveredAction` and branch inside it based on parcel status. Rejected because it would mix delivery proof, COD collection, rider payout, and return-deduction rules inside one mutation path.

### Allow riders to perform `canceled_returned -> returned_to_merchant`

Extend the permission model so riders can perform this single additional transition when the parcel is assigned to their own rider account. Office admins and super admins can keep their existing manual-correction powers.

Why this approach:

- The rider is the operational actor completing the physical return.
- The server already scopes rider parcel mutations through the rider profile, so the same ownership pattern can protect this transition.
- It resolves the current mismatch where riders can see return work but cannot finish it.

Alternative considered:

- Keep the transition admin-only and ask admins to complete it after rider handoff. Rejected because it leaves the rider workflow incomplete and disconnects status completion from the physical actor.

### Keep return completion lightweight and proofless for now

Return completion should not require delivery-proof image upload unless a later requirement adds it. The request only requires the status transition and the financial-item creation rule.

Why this approach:

- It solves the current workflow gap with minimal scope.
- The existing return rule in the main docs does not define proof artifacts for returned parcels.
- It avoids coupling this fix to storage/upload complexity that is currently specific to successful customer delivery.

Alternative considered:

- Require a return proof photo like normal delivery. Rejected for now because there is no existing domain rule or UI requirement for it.

### Preserve rider assignment on completed returns

When a rider completes a merchant return, keep `rider_id` intact and set `returned_to_merchant_at`. The status move removes the parcel from the rider `To Deliver` tab and makes it visible in a dedicated rider `Returned` tab because the rider list is status-based.

Why this approach:

- It preserves who completed the return without introducing new audit columns.
- It matches the current delivered flow, which keeps rider linkage after completion.
- It lets admin views continue showing which rider handled the return.

Alternative considered:

- Clear `rider_id` when the parcel becomes `returned_to_merchant`. Rejected because it loses useful operator history and is not required for the rider list to stop showing the parcel.

### Generate only the merchant deduction financial item on return completion

The return-completion transaction should create one pending `financial_items` row with `item_type = delivery_fee_deduction`, `amount = parcel.delivery_fee`, and the parcel/merchant linkage. It should not create `cod_remit` or `rider_way_payout` items.

Why this approach:

- It matches the existing settlement rule that only physically returned parcels are eligible for delivery-fee deduction.
- The documented rider payout model is based on delivered-way count, not returned-way count.
- It keeps return completion financially distinct from successful customer delivery.

Alternative considered:

- Also create a rider payout item on return completion. Rejected because no current doc or payout rule defines return work as an eligible rider-way payout event.

## Risks / Trade-offs

- Action-label ambiguity between "Mark Delivered" and a return-specific label -> Use return-specific wording in specs/design so the implementation does not encode a misleading status concept.
- Existing docs and older change artifacts describe admin-only completion -> Update the main product spec now and let this change supersede older implementation assumptions.
- Return completion without proof may reduce audit detail -> Preserve `rider_id`, `returned_to_merchant_at`, and status logs so there is still operator traceability.
- Duplicate financial-item creation could occur if the action is retried after success -> Require DAL guards on current status and perform the parcel update plus financial-item insert in one transaction.

## Migration Plan

1. Update docs and OpenSpec artifacts to declare rider-owned return completion.
2. Extend permissions and add a dedicated rider server action/DAL path for `canceled_returned -> returned_to_merchant`.
3. Update the rider parcel card workflow to expose the return completion action for assigned `canceled_returned` parcels.
4. Verify the returned parcel exits the rider `To Deliver` tab, appears in the rider `Returned` tab, and creates exactly one pending `delivery_fee_deduction` item.

Rollback is straightforward: remove the rider action path and UI affordance, and restore the prior admin-only completion rule if implementation reveals an unexpected operational constraint.
