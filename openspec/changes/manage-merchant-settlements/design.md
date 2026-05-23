## Context

The repository already has the core building blocks for merchant settlement, but only as partial scaffolding. Delivered parcels can create `cod_remit` financial items, returned parcels can create `delivery_fee_deduction` items, and the settlements page can list persisted settlement rows. The missing piece is the operational workflow:

- the admin dashboard still shows a parcel table instead of settlement work,
- the settlements page exposes a placeholder `Create Settlement` sheet even though creation should come from eligible financial items,
- settlement creation does not yet reserve selected financial items,
- settlement resolution does not yet capture bank transfer proof or enforce superadmin-only completion.

This change stays inside the Next.js monolith and the existing settlements feature slice. It must follow the repo UI rules by using an admin dashboard page, shadcn tables, and a right-side sheet for the create flow.

## Goals / Non-Goals

**Goals:**

- Show admins which merchants currently have eligible settlement items.
- Create merchant settlements from selected eligible `financial_items` on the dashboard page.
- Persist newly created settlements with `pending` status and reserve the selected items so they cannot be drafted twice.
- Remove the old settlement-creation affordance from the settlements listing page.
- Let only superadmins resolve pending settlements by uploading bank transfer receipt proof from the listing page.
- Keep the UI structure ready for later rider payout tabs without implementing rider payout creation now.

**Non-Goals:**

- Do not implement rider payout creation or rider payout resolution in this change.
- Do not introduce a separate back-office service, job queue, or accounting ledger.
- Do not redesign the existing parcel summary cards on the dashboard unless required to fit the new settlement workspace.
- Do not add merchant-facing settlement actions; this flow is admin and superadmin only.
- Do not define full cancellation or edit-after-creation behavior unless required for safe pending-settlement handling.

## Decisions

### Move settlement creation to the admin dashboard

The admin dashboard will become the settlement creation workspace for office users by replacing the parcel table with a merchant eligibility list. Each merchant row opens a right-side sheet containing eligible financial items, totals, and the settlement submit action.

Why this approach:

- It matches the requested office workflow instead of burying creation in the listing page.
- It keeps the dashboard useful for daily finance operations after parcel summary cards.
- It preserves the settlements page as a historical and resolution-oriented listing rather than mixing creation and payment confirmation in one place.

Alternative considered:

- Keep creation on the settlements page and add an eligible-merchants section there. Rejected because it conflicts with the requested dashboard-first workflow and leaves the dashboard parcel table in the way.

### Introduce a distinct `pending` settlement status

Generated merchant settlements will be created with `pending` status, not `in_progress`. `pending` means the settlement has been assembled from selected financial items and is waiting for superadmin payment proof. `settled` remains the terminal paid state, and `void` can stay available for future cancellation handling if already present.

Selected financial items should move to `in_progress` and link to the new settlement immediately so they are reserved against duplicate settlement generation while the settlement itself is awaiting resolution.

Why this approach:

- It matches the product language from the request: creation produces a pending settlement.
- It separates settlement lifecycle from financial-item reservation state.
- It allows the list page to clearly distinguish "awaiting transfer proof" from "paid".

Alternative considered:

- Keep settlement status as `in_progress` and treat it as equivalent to pending. Rejected because it blurs the distinction the requested workflow explicitly introduced and makes the UI harder to explain.

### Aggregate eligibility by merchant from financial items

Dashboard eligibility should be driven from `financial_items` rather than parcels or settlements. A merchant is eligible when they have at least one `financial_items` row for settlement (`cod_remit` or `delivery_fee_deduction`) with `status = pending` and no attached `merchant_settlement_id`.

Why this approach:

- It aligns with the documented financial-item settlement model already in the project docs.
- It avoids re-deriving settlement eligibility from parcel states that may have already been summarized into financial items.
- It creates a direct path from eligible item query to selected-item settlement transaction.

Alternative considered:

- Build dashboard eligibility from parcel statuses and calculate implied amounts on the fly. Rejected because it duplicates the financial-item abstraction and increases risk of mismatch.

### Block negative settlement generation

Settlement creation must reject any selection where total selected `delivery_fee_deduction` amount is greater than total selected `cod_remit` amount. In practice, that means a deduction-only selection cannot be submitted, and mixed selections must stay at zero or positive net payment.

Why this approach:

- It matches the business rule that the app cannot generate a merchant settlement with a negative payout.
- It prevents creating pending settlement rows that would still require unresolved debt handling outside the modeled workflow.
- It keeps the backend and dashboard sheet aligned on one simple validation rule.

Alternative considered:

- Allow negative settlement generation and ask admins to handle the remainder manually. Rejected because the current settlement model has no debt-carry or separate adjustment workflow.

### Resolve pending settlements from the listing page with receipt upload

The settlements listing page will keep the table, but row actions for pending settlements will open a superadmin-only resolution flow. The resolution action uploads a bank transfer receipt, stores the receipt reference on the settlement, marks the settlement `settled`, stamps settlement metadata, and settles the linked financial items atomically.

Why this approach:

- It keeps creation and payment confirmation in distinct operational surfaces.
- It supports auditability for real money transfer confirmation.
- It fits the existing page model where settlements listing is the place to review created settlement records.

Alternative considered:

- Resolve settlements in the same dashboard sheet used for creation. Rejected because the request explicitly places resolution on the settlements listing page and because confirmation should be a more privileged action.

### Store receipt metadata on the settlement record

Receipt upload should persist as settlement-level metadata, most likely an object-storage key plus uploaded-at and uploaded-by information. The exact schema can be minimal, but the design assumes receipt proof belongs to the settlement record rather than to each financial item.

Why this approach:

- One bank transfer receipt proves the whole settlement payment, not each underlying item individually.
- It keeps retrieval and display localized to the settlement feature.
- It matches the existing R2/object-storage pattern already available in the stack.

Alternative considered:

- Do not persist a receipt and only mark the settlement settled. Rejected because the user explicitly asked for bank transfer receipt upload as the resolution step.

## Risks / Trade-offs

- Settlement status semantics become more complex because settlement rows and financial items no longer share the same status words exactly -> Keep the DTOs and status badges explicit about settlement state versus financial-item reservation state.
- Receipt upload adds storage and validation work to a flow that was previously placeholder-only -> Keep the first version narrow to a single required receipt file and settlement-level metadata.
- Dashboard focus shifts away from parcel operations for admins -> Preserve the parcel summary cards and move only the bulky parcel table, which the request explicitly asked to remove.
- Duplicate or stale item selection can occur if two admins create settlements concurrently -> Re-check selected item eligibility inside one transaction before inserting the settlement and updating items.

## Migration Plan

1. Add or adjust settlement persistence so merchant settlements can store `pending` state and receipt metadata.
2. Implement dashboard queries and sheet flow for eligible merchants and their pending financial items.
3. Implement the settlement-creation transaction that inserts a pending settlement and reserves selected financial items atomically.
4. Remove the create button from the settlements listing page and replace it with pending-settlement resolution actions.
5. Implement superadmin receipt-upload resolution that settles the settlement and linked financial items atomically.
6. Update documentation and verify role behavior, duplicate-selection prevention, and settled-state UI.

Rollback is straightforward: restore the old dashboard parcel table and settlement listing affordance, and revert the new pending-resolution UI if deployment reveals operational issues. Any rollback must also safely release reserved financial items from unfinished settlements.
