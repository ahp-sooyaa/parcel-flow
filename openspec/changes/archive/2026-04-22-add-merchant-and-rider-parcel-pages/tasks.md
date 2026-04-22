## 1. Role-Aware Parcel Server Foundations

- [x] 1.1 Extend `src/features/parcels/server/dal.ts` to resolve admin, merchant-owned, and rider-assigned parcel scopes for list/detail queries.
- [x] 1.2 Add parcel DTO shapers for merchant and rider detail/list payloads so each role receives only allowed fields.
- [x] 1.3 Add server-side parcel authorization helpers in `src/features/parcels/server/utils.ts` for merchant self-scope, rider assignment checks, and rider delivery eligibility.

## 2. Merchant Parcel Access

- [x] 2.1 Update `/dashboard/merchants/[id]` to load merchant-owned parcel list data for merchant self-scope without requiring `parcel-list.view`.
- [x] 2.2 Reuse shared parcel detail/create/edit routes for merchant users and enforce merchant ownership in page loaders and server actions.
- [x] 2.3 Ensure merchant parcel create/edit flows derive or validate merchant ownership on the server and reject cross-merchant access attempts.

## 3. Rider Parcel Detail and Workflow Actions

- [x] 3.1 Add rider-scoped parcel detail loading that only returns parcels assigned to the current rider.
- [x] 3.2 Build rider-specific parcel detail UI that shows operational fields such as parcel type, COD/non-COD context, collectable amount, and the current next-step action state.
- [x] 3.3 Implement dedicated rider workflow server actions backed by an explicit allowed-transition map for rider-managed parcel statuses.
- [x] 3.4 Deny rider access to parcel create and edit routes while preserving parcel detail access for assigned parcels.

## 4. Verification and Regression Coverage

- [x] 4.1 Add tests for merchant self-scope parcel list/detail/create/edit access, including denial for other merchants' parcels.
- [x] 4.2 Add tests for rider assigned-parcel detail access, next-step action rendering, allowed transition success, and denial for unassigned or disallowed transitions.
- [x] 4.3 Re-verify admin parcel create/update/cancellation behavior to ensure role expansion does not weaken existing admin controls.
