## 1. Settlement Workflow Documentation

- [x] 1.1 Update `docs/parcel-flow-project-spec.md` to describe merchant-settlement creation from eligible `financial_items`, pending settlement status, and superadmin receipt-based settlement resolution.
- [x] 1.2 Update any settlement-related technical docs so the dashboard creation flow and listing-page resolution flow match the intended office workflow.

## 2. Settlement Persistence And Validation

- [x] 2.1 Update settlement domain types, schema, and DTOs to support `pending` merchant settlement status and settlement-level bank transfer receipt metadata.
- [x] 2.2 Add Zod validation for dashboard settlement creation from selected merchant financial items and for superadmin receipt-based settlement resolution.
- [x] 2.3 Add DAL transaction logic that creates a pending settlement, links and reserves selected eligible financial items, and rejects stale or cross-merchant selections atomically.
- [x] 2.4 Add DAL transaction logic that settles a pending settlement, stores receipt metadata, and marks linked financial items as settled atomically.

## 3. Admin Dashboard Settlement Creation UI

- [x] 3.1 Replace the current parcel table on `src/app/dashboard/page.tsx` with a merchant settlement workspace while preserving the summary cards.
- [x] 3.2 Add dashboard queries and UI components to list merchants with eligible settlement financial items and show an empty state when none are eligible.
- [x] 3.3 Build the right-side merchant settlement sheet that lists eligible financial items, supports multi-select, shows totals, and submits settlement creation.
- [x] 3.4 Keep the dashboard structure ready for later settlement tabs, but ship only the merchant settlement tab in this change.

## 4. Settlement Listing Resolution UI

- [x] 4.1 Remove the current `Create Settlement` button and placeholder creation sheet from `src/app/dashboard/settlements/page.tsx`.
- [x] 4.2 Update the settlements listing UI to display the new `pending` state clearly and expose a superadmin-only resolution action for pending rows.
- [x] 4.3 Build the receipt-upload settlement resolution flow from the listing page and refresh the table after successful settlement.

## 5. Verification

- [x] 5.1 Verify only authorized admins can create settlements and only superadmins can resolve pending settlements.
- [ ] 5.2 Verify a newly created settlement appears in the listing with `pending` status and selected financial items cannot be reused in another settlement.
- [ ] 5.3 Verify successful resolution stores bank transfer receipt proof and marks both the settlement and linked financial items as settled.
- [x] 5.4 Run lint after implementation.
- [x] 5.5 Run typecheck after implementation.
