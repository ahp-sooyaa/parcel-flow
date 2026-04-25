## 1. Data Model And Migration

- [x] 1.1 Add merchant financial item schema definitions, lifecycle fields, and supporting indexes in `src/db/schema.ts`.
- [x] 1.2 Broaden merchant settlement document and item schema so snapshots can store mixed credit/debit candidate totals and direction-aware settlement data.
- [x] 1.3 Generate the Drizzle migration from the schema changes and verify the generated SQL matches the intended additive rollout.
- [x] 1.4 Implement a backfill or reconciliation path that creates open merchant financial items from current parcel and parcel payment state for existing merchants.

## 2. Merchant Financial Item Derivation

- [x] 2.1 Add merchant financial item DAL, DTO, and helper modules under `src/features/merchant-settlements/server/` for ready and blocked settlement candidates.
- [x] 2.2 Implement candidate derivation rules for COD remittance credits, `bill_merchant` delivery-fee debits, and verified cancelled-parcel refund credits.
- [x] 2.3 Update parcel and payment mutation flows so relevant state transitions create, refresh, void, or block merchant financial items deterministically.
- [x] 2.4 Add reconciliation-safe guards to prevent duplicate open merchant financial items for the same source obligation.

## 3. Settlement Workspace UI

- [x] 3.1 Update merchant detail settlement entry points so authorized staff see one dominant `Open Settlement Workspace` action plus contextual shortcut buttons on `COD in Held`, `Pending Delivery Fee`, and `Returned` cards.
- [x] 3.2 Replace the COD-only settlement picker read path with merchant-scoped ready and blocked settlement candidate queries.
- [x] 3.3 Add merchant-detail shortcut preset handling so `Process Settlement` preselects delivered COD candidates and `Resolve Fees` / `Handle Returns` prefilter the workspace to the correct candidate slices.
- [x] 3.4 Update the settlement workspace table to render mixed candidate rows with candidate type, direction, amount, and blocked reasons.
- [x] 3.5 Update the sticky settlement summary bar to show selected credits, debits, net amount, and resulting remit-or-invoice direction.

## 4. Settlement Document Lifecycle

- [x] 4.1 Refactor settlement generation to accept selected merchant financial item ids instead of raw COD parcel payment record ids.
- [x] 4.2 Implement transaction-safe document creation that snapshots selected candidate values, derives document direction from net totals, and locks selected merchant financial items.
- [x] 4.3 Update settlement history and detail shaping to show credits total, debits total, net amount, direction, and direction-appropriate bank snapshots.
- [x] 4.4 Update settlement confirmation, cancellation, and rejection flows so remit and invoice proofs close or reopen merchant financial items correctly.
- [x] 4.5 Preserve immutable paid settlement snapshots and reject stale, cross-merchant, or overlapping candidate selections.

## 5. Verification And Documentation

- [x] 5.1 Add server tests for candidate derivation across delivered COD remits, merchant billing cases, and verified refund cases.
- [x] 5.2 Add transaction and authorization tests for lock contention, cancel or reject release, paid immutability, and merchant scope enforcement.
- [x] 5.3 Update operator-facing settlement documentation and internal notes to reflect mixed settlement candidates, remit vs invoice behavior, and refund eligibility rules.
