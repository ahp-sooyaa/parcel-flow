## Context

The admin dashboard already uses a settlement workspace with tabs, summary tables, and a right-side sheet for merchant settlement drafting. Rider delivery completion marks delivered parcels with `parcels.is_received_by_office = false`, which correctly captures that cash is still with the rider, but there is no admin flow to review those delivered parcels by rider and confirm when the office receives the handover.

This change needs to cover both COD and non-COD delivered parcels. COD parcels should not create a `cod_remit` financial item until the office confirms handover, while non-COD delivered parcels still carry collected delivery fee cash only on the parcel record. Because of that timing rule, rider cash handover eligibility cannot be driven only by existing merchant settlement item queries.

## Goals / Non-Goals

**Goals:**

- Reuse the existing admin settlement workspace structure by adding a `Rider Cash Handover` tab and right-side sheet flow.
- Show riders with pending office handover work based on delivered parcels where `is_received_by_office = false`.
- Let admins select multiple or all eligible parcels for one rider and confirm cash receipt in a single action.
- Persist office receipt confirmation atomically on the selected parcels and keep the rider list/sheet in sync after submission.
- Create deferred `cod_remit` financial items for selected COD parcels during office handover confirmation.

**Non-Goals:**

- Creating rider payout drafting or payment workflows.
- Redesigning the merchant settlement UI beyond the minimal shared workspace updates needed for the new tab.
- Introducing a new backend service, new dependency, or a broad financial ledger redesign.

## Decisions

### 1. Keep the feature inside the existing settlements workspace

The admin-facing interaction already exists in `src/features/settlements/components/merchant-settlement-workspace.tsx`, so the rider flow should be added as a sibling tab in the same workspace instead of building a separate dashboard page. This keeps the dashboard information architecture stable and satisfies the requirement to use the same UI structure as merchant settlements.

Alternative considered: a separate admin page or a riders page action. Rejected because it duplicates table, sheet, and mutation patterns the settlements workspace already owns.

### 2. Drive eligibility from delivered parcels grouped by rider

Eligible handover work should come from delivered parcels where the rider is assigned, the parcel is not soft-deleted, and `is_received_by_office = false`. The query should group those parcels by rider and compute row totals from parcel-level fields:

- parcel count
- COD amount total for COD parcels
- delivery fee total for all delivered parcels
- total handover cash from `collected_amount`

This choice is required because non-COD delivered parcels still represent physical cash handover through delivery fee collection even when there is no `cod_remit` financial item.

Alternative considered: driving the tab entirely from `financial_items`. Rejected because it would omit non-COD delivered parcels and make the admin flow inconsistent with the business rule in the request.

### 3. Confirm handover as a parcel-based bulk mutation with deferred COD remit creation

The sheet action should submit selected parcel ids for a single rider. The server mutation should:

- validate the actor is an admin or superadmin
- validate every selected parcel still belongs to the targeted rider
- validate every selected parcel is delivered and still has `is_received_by_office = false`
- update selected parcels to `is_received_by_office = true`
- set `collection_confirmed_by` to the acting user id
- create one pending `financial_items` row with `item_type = cod_remit` and `amount = parcel.cod_amount` for each selected COD parcel
- update timestamps atomically

The mutation should not create a new settlement or payout record. Its responsibility is to confirm office receipt of rider-held cash and to make confirmed COD cash eligible for later merchant settlement by generating the `cod_remit` item at that moment.

Alternative considered: storing handover confirmations on a new `rider_cash_handovers` table. Rejected for now because the request only needs confirmation state on parcels, and the current schema already models office receipt with a dedicated boolean plus confirmation user field.

### 4. Keep financial item behavior minimal and explicit

This change should not invent new financial item types for non-COD delivery fee handovers. Instead, the confirmed state lives on parcels, COD parcels generate `cod_remit` only when office handover is confirmed, and existing delivery-fee deduction items remain unchanged for returned parcels. This keeps merchant settlement eligibility aligned with the meaning of `financial_items`: the row exists only when the parcel is actually ready to settle or remit to the merchant.

Alternative considered: adding a new financial item per non-COD handover. Rejected because it expands the accounting model beyond the user request and would require a broader spec change for settlement/payout rules.

## Risks / Trade-offs

- [Parcel-level confirmation does not create a separate audit record] -> Mitigation: persist `collection_confirmed_by` and updated timestamps, and keep the change scoped to the existing schema.
- [Handover confirmation could accidentally create duplicate `cod_remit` items] -> Mitigation: revalidate that selected parcels still have `is_received_by_office = false`, and make item creation part of the same transaction as the parcel update.
- [Merchant settlement queries may remain too permissive if they rely on preexisting COD remit rows] -> Mitigation: shift COD remit creation to handover confirmation so eligibility naturally follows office receipt without extra query-only guard logic.
- [Bulk selection can become stale while the sheet is open] -> Mitigation: revalidate every submitted parcel on the server and fail atomically when any selected parcel is no longer eligible.
- [The shared workspace component can become too coupled] -> Mitigation: split rider-specific DTOs, DAL, and action handlers under `src/features/settlements/server` and keep the tab UI as a thin composition layer.
