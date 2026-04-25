## Context

The current merchant settlement workflow is implemented as a COD-only remittance flow. Settlement mode is entered from the merchant detail page, eligibility is recalculated directly from `parcels` and `parcel_payment_records`, the picker only shows delivered COD parcels, and document creation assumes the company is paying money out to the merchant.

The planned workflow is broader:

- delivered COD parcels can create remittance credits
- returned, failed, or non-COD parcels can create merchant-billed delivery-fee debits
- cancelled parcels can create refund credits when merchant prepaid receipt was verified and the parcel remains refundable
- operators must be able to select only credits, only debits, or a mixed set from the same settlement workspace

This change must preserve the current project constraints:

- `parcels` and `parcel_payment_records` remain the operational and accounting truth
- settlement generation must stay server-authorized, auditable, and fail closed
- the UI entry point remains merchant-scoped and lives on merchant detail
- rider payouts are a separate future workflow, not a reason to generalize everything now

## Goals / Non-Goals

**Goals:**

- Support one merchant settlement workspace that can surface mixed settlement candidates for a single merchant.
- Move settlement selection from raw parcel eligibility to auditable finance candidates that can represent credits and debits.
- Allow the workspace to derive document direction explicitly from selected totals so the result can be a remit or an invoice.
- Preserve immutable paid snapshots, active-lock protections, cancellation/rejection release behavior, and merchant-only scoping.
- Keep refund eligibility narrow by requiring verified incoming merchant payment before a refundable cancelled parcel can create a credit candidate.

**Non-Goals:**

- Implement rider payout workflow in this change.
- Build a single generic payment module shared by merchant settlement and rider payout from day one.
- Redesign the entire parcel payment verification workflow beyond the prerequisites needed to decide whether settlement candidates may be created.
- Define every future adjustment type now; manual adjustments can be designed later once the core merchant candidate model is stable.

## Decisions

### 1. Add merchant financial items as a derived finance ledger

Merchant settlement generation will no longer rely only on on-the-fly selection queries from `parcels` and `parcel_payment_records`. Instead, the system will persist merchant financial items that represent open merchant-facing credits and debits derived from parcel/payment truth.

Each item should capture at least:

- merchant id
- source parcel id and/or parcel payment record id
- candidate kind, such as `cod_remit_credit`, `delivery_fee_charge`, or `refund_credit`
- direction, such as `company_owes_merchant` or `merchant_owes_company`
- amount
- readiness or blocked state with reason metadata
- lifecycle state, such as `open`, `locked`, `closed`, or `void`

Why this approach:

- one parcel can produce different financial outcomes over time
- mixed remit/invoice selection becomes auditable
- settlement documents can snapshot item values without re-deriving business meaning later
- refund and bill-merchant cases fit naturally without forcing them into COD-specific math

Alternative considered: keep deriving everything at settlement time from parcel/payment state. Rejected because it remains COD-shaped, does not model mixed credits/debits cleanly, and becomes brittle once a parcel can create more than one merchant-facing financial obligation.

### 2. Keep `parcels` and `parcel_payment_records` as source truth, not settlement tables

The new financial items are derived records, not replacements for parcel state. Parcel operations, delivery fee resolution, COD collection, office receipt, and verified merchant payment still live in parcel tables and parcel actions. Merchant financial items are downstream settlement candidates generated from that truth.

Why this approach:

- operational workflows remain explicit and auditable where they already belong
- settlement logic stays aligned with parcel lifecycle rules
- finance records can be rebuilt or reconciled from known parcel/payment truth if needed

Alternative considered: move all merchant receivable/payable truth into the new finance tables. Rejected because it duplicates parcel accounting state and risks drift between operations and finance.

### 3. Settlement mode selects financial item ids, not parcel ids

The settlement workspace will still feel parcel-centric in the UI, but the actual selection unit will be the merchant financial item. This allows one parcel to contribute more than one financial outcome across time without forcing every future case into a single parcel-level settlement link.

Why this approach:

- credits and debits can coexist in one workspace
- future manual adjustments do not require fake parcels
- locking rules apply to the actual financial obligation, not an overloaded parcel reference

Alternative considered: keep selecting parcel payment record ids. Rejected because that works only while the workflow assumes one settlement-relevant outcome per parcel payment record.

### 4. Reuse merchant detail settlement mode as the workspace, but broaden entry points with a spoke-and-hub pattern

The settlement workspace should remain on merchant detail to preserve merchant scope and operator familiarity. Merchant detail should expose one dominant `Open Settlement Workspace` action near the merchant header or in a `Financial Actions` section, and card-level buttons should act as contextual shortcuts into that same workspace instead of launching separate workflows.

The shortcut behavior should be:

- `COD in Held` card: `Process Settlement` opens the workspace with the delivered COD remit-credit slice preselected
- `Pending Delivery Fee` card: `Resolve Fees` opens the workspace prefiltered to fee-related debit candidates such as returned-fee and unpaid-fee items
- `Returned` card: `Handle Returns` opens the workspace prefiltered to returned-parcel settlement candidates
- `Open Settlement Workspace`: opens the full merchant-scoped workspace without shortcut filtering so operators can reconcile all ready and blocked candidates together

Why this approach:

- operators keep one place to review all merchant-facing settlement work
- the UI does not fragment into separate remit, invoice, refund, and return pages
- merchant scope stays obvious and server-enforced
- summary cards become spokes into the same hub rather than competing workflows

Alternative considered: separate pages for COD remittance, merchant billing, and refunds. Rejected because it splits one financial conversation into multiple operational surfaces and makes optional netting harder to understand.

### 5. Keep one merchant settlement document workflow with explicit direction

The document workflow should stay unified, but each generated document must record direction explicitly based on selected totals:

- positive net => remit
- negative net => invoice

The document model must store totals in a direction-aware way, including credits total, debits total, and net total, plus the correct bank snapshot for the payer/payee direction.

Why this approach:

- users can create separate or combined settlements from the same workspace
- history remains one coherent merchant document trail
- remit and invoice confirmation flows can differ without requiring two separate workspaces

Alternative considered: create entirely separate remit and invoice document types with separate list/detail flows. Rejected because the user explicitly wants both separate and combined handling from the same settlement mode.

### 6. Refund credits require verified incoming payment and explicit refund eligibility

A cancelled parcel only becomes a refund candidate if the merchant’s prepaid delivery fee was actually verified as received and the parcel is still refund-eligible under the operational policy. Merchant-uploaded receipt evidence alone is insufficient.

Why this approach:

- avoids creating fake company liabilities from unverified merchant claims
- keeps refund logic auditable and aligned with actual cash movement
- prevents duplicate or premature refund credits

Alternative considered: treat uploaded merchant payment slip as enough to create a refund candidate. Rejected for accounting risk.

### 7. Rider payouts stay separate, with only small shared finance helpers

This change will not attempt to create a unified merchant/rider payment module. Merchant settlement workspace and future rider payouts may later share helpers such as money formatting, proof validation, and audit utilities, but they should remain separate features with separate business rules.

Why this approach:

- merchant settlement and rider payout solve different problems with different actors and liability directions
- generic abstraction now would be premature and COD-specific assumptions would leak into rider payout

Alternative considered: introduce a fully generic payment module now. Rejected because the rider workflow is not designed yet and would force abstraction without enough stable common behavior.

## Risks / Trade-offs

- [Derived financial items drift from parcel/payment truth] → Add deterministic candidate refresh logic on relevant parcel/payment transitions and provide a reconciliation/backfill command for repair.
- [Settlement workspace becomes harder to understand than the current COD-only picker] → Show ready vs blocked candidates separately and summarize credits, debits, net amount, and resulting direction in the sticky footer.
- [Mixed credit/debit documents confuse proof and confirmation rules] → Store explicit document direction and require direction-specific proof fields instead of inferring behavior only from sign.
- [Existing COD settlement tables are too specific for the broader workflow] → Broaden the document model incrementally and migrate COD-only snapshot logic toward candidate-based snapshots without changing operational parcel truth.
- [Refund rules are underspecified] → Keep refund candidate creation behind explicit verified-payment and refund-eligibility checks, and document any remaining cutoff policy as an open question before implementation.

## Migration Plan

1. Add merchant financial item storage and any required settlement document snapshot changes in the schema.
2. Backfill open merchant financial items from current parcel/payment state for merchants with existing eligible COD remittance records.
3. Update merchant detail settlement mode to read ready and blocked settlement candidates from merchant financial items while preserving merchant scope and authorization checks.
4. Add merchant-detail settlement shortcut presets and map each shortcut button to the correct workspace filter or preselection behavior.
5. Update settlement generation, confirmation, cancellation, and rejection flows to lock and release merchant financial items instead of relying on COD-only parcel selection.
6. Preserve existing settlement history readability by mapping old paid COD records into the broadened detail/list presentation.
7. Remove COD-only assumptions from the settlement picker once candidate-based generation is stable.

Rollback strategy:

- keep schema changes additive until the candidate-based workspace fully replaces the COD-only query path
- preserve existing COD settlement records and history rendering
- if rollout issues appear, switch the merchant detail read path back to the current COD-only eligibility query while leaving additive tables intact

## Open Questions

- Should zero-net selection create a `balanced` document, or should the workspace reject zero-net submission and require users to split or adjust the selection? Answer: create balanced document
- Should merchant detail show new summary cards for open charges and refundable credits, or is a generic settlement-workspace entry sufficient for non-COD cases? Answer: generic settlement-workspace entry is enough for 'action' but for visibility we should show summary cards for open charges and refundable credits
- Should manual merchant adjustments be included in the first version of merchant financial items, or should the initial release cover only parcel-derived credits and debits? Answer: yes manual merchant adjustments should be included in the first version of merchant financial items but only permission to superadmin.
