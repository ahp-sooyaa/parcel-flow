## 1. Rider handover data and server contracts

- [x] 1.1 Add settlement DTO types for rider cash handover list rows, rider parcel sheet items, and handover confirmation payloads under `src/features/settlements/server/dto.ts`.
- [x] 1.2 Implement DAL queries in `src/features/settlements/server/dal.ts` that group delivered `is_received_by_office = false` parcels by rider and return the selected rider's eligible parcel details with COD, delivery fee, and collected totals.
- [x] 1.3 Update rider delivery persistence so COD parcel delivery no longer creates `cod_remit`, while `rider_way_payout` behavior remains unchanged.
- [x] 1.4 Review merchant settlement eligibility queries and tighten them if needed so COD settlement work does not bypass office handover confirmation.

## 2. Rider handover confirmation action

- [x] 2.1 Add a Zod-backed server action in `src/features/settlements/server/actions.ts` for confirming office receipt of selected rider parcels.
- [x] 2.2 Implement atomic parcel validation and updates so selected delivered parcels for one rider are marked `is_received_by_office = true`, `collection_confirmed_by` is set, and COD parcels create deferred `cod_remit` items without partial success.
- [x] 2.3 Revalidate the dashboard settlement route after successful rider handover confirmation.

## 3. Admin dashboard workspace UI

- [x] 3.1 Extend the settlements workspace component to add the `Rider Cash Handover` tab beside the existing merchant settlements tab.
- [x] 3.2 Build the rider handover table UI with row totals and a `Confirm Handover` action that opens a right-side sheet.
- [x] 3.3 Build the rider handover sheet with parcel rows, select-all behavior, multi-select totals, empty states, and submit/error handling aligned with the merchant settlement sheet pattern.

## 4. Verification

- [x] 4.1 Add unit or integration coverage for rider handover eligibility queries, including COD and non-COD delivered parcel cases.
- [x] 4.2 Add unit or integration coverage for successful and rejected handover confirmation submissions, including COD remit creation, non-COD no-op behavior, and stale or mixed-rider selections.
- [x] 4.3 Run lint and typecheck after implementation and resolve any issues introduced by the change.
