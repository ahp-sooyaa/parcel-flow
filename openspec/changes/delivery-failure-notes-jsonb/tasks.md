## 1. Schema and Migration

- [x] 1.1 Update the Drizzle parcel schema so `deliveryFailureNote` maps to the existing `delivery_failure_note` column as a JSONB failure-note entry array.
- [x] 1.2 Add the database migration that converts `parcels.delivery_failure_note` from nullable text to nullable JSONB while preserving the column name.
- [x] 1.3 Backfill existing non-empty text failure notes into one JSONB entry and mark each migrated entry `active` only for unresolved `on_the_way` parcels that still have an assigned rider.
- [x] 1.4 Add feature-local Zod parsing helpers for the failure-note JSONB shape and active-note derivation.

## 2. Parcel Server Logic

- [x] 2.1 Update rider failure-report validation and DAL writes to append a new `{ note, status: \"active\" }` entry only when the parcel has no active failure note.
- [x] 2.2 Update admin failure-resolution DAL logic so `postpone` and `canceled_returned` decisions mark the current active failure note entry `inactive` in the same transaction as the parcel status update.
- [x] 2.3 Expose normalized failure-note history and `activeFailureNote` fields through parcel DTOs/read models used by rider and admin screens.
- [x] 2.4 Preserve existing authorization, status eligibility, assignment clearing, revalidation, and no-financial-side-effect rules around rider reporting and admin resolution.

## 3. Rider Workflow UI

- [x] 3.1 Update the rider parcel card to show `Report Failure` and `Mark Delivered` only when no active failure note exists for an assigned `on_the_way` parcel.
- [x] 3.2 Show `View Failure Note` instead of those actions when an active failure note exists.
- [x] 3.3 Update the rider failure-note dialog so it displays the active failure note in review mode without exposing a second active submission path.
- [x] 3.4 Verify rider list filtering and parcel-card refresh behavior still keep unresolved failed parcels in the `To Deliver` flow.

## 4. Admin Review UI

- [x] 4.1 Add a `Need review` tab to the admin parcel listing page that filters parcels with an active failure note.
- [x] 4.2 Reuse or update the existing failure warning/review affordance so admins review the currently active failure note content from the parcel list.
- [x] 4.3 Ensure parcels leave the `Need review` tab immediately after `postpone` or `canceled_returned` marks the active note inactive.
- [x] 4.4 Keep the review queue and controls hidden from rider and merchant parcel surfaces.

## 5. Tests and Verification

- [x] 5.1 Add migration or DAL coverage for legacy text-note backfill and active/inactive status derivation.
- [x] 5.2 Add server-side tests for rider failure-note append rules, duplicate-active-note rejection, and admin resolution note deactivation.
- [x] 5.3 Add UI/component coverage for rider button visibility changes and the admin `Need review` filter behavior.
- [x] 5.4 Run lint, typecheck, and the relevant parcel test suites after implementation.
