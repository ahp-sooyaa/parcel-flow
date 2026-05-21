## 1. Data and Server Rules

- [x] 1.1 Add parcel DAL helpers to resolve failed parcels to `postpone` or `canceled_returned` in a transaction.
- [x] 1.2 Validate admin authorization, `on_the_way` status, non-empty `delivery_failure_note`, and existing rider assignment before failure resolution writes.
- [x] 1.3 Clear `rider_id` and `assigned_at` when either failure resolution succeeds.
- [x] 1.4 Write parcel status log entries for the admin failure decisions.
- [x] 1.5 Ensure no merchant settlement, rider payout, delivered, collected, or returned side effects are created by failure resolution.
- [x] 1.6 Confirm rider and parcel expected collection queries exclude parcels immediately after assignment is cleared.

## 2. Server Actions and DTOs

- [x] 2.1 Add Zod-validated admin server actions for `Postpone` and `Return Merchant` failure decisions.
- [x] 2.2 Revalidate admin parcel, rider summary, and rider parcel routes after successful failure decisions.
- [x] 2.3 Return actionable validation messages for stale dialogs, missing failure notes, unauthorized users, and ineligible statuses.
- [x] 2.4 Add DTO/read-model support for determining unresolved failure review state in admin parcel rows.

## 3. Admin Parcel UI

- [x] 3.1 Add a red warning icon button immediately to the right of the parcel code for unresolved failed parcels.
- [x] 3.2 Build a shadcn/ui dialog that displays parcel code, rider failure note, and `Postpone` and `Return Merchant` buttons.
- [x] 3.3 Wire dialog actions to the admin server actions with pending, success, and error states.
- [x] 3.4 Hide the warning icon and dialog controls from merchant and rider parcel views.
- [x] 3.5 Ensure the warning icon disappears after a parcel is resolved to `postpone` or `canceled_returned`.

## 4. Follow-up Assignment Flow

- [x] 4.1 Verify return-ready `canceled_returned` parcels remain assignable for merchant return handling.
- [x] 4.2 Ensure unassigned postponed parcels are assignable for retry and automatically change to `at_office` during assignment.
- [x] 4.3 Update admin selection logic and assignment error copy to include at-office, postponed, and return-ready parcels.
- [x] 4.4 Confirm assigned `canceled_returned` parcels remain `canceled_returned` after assignment.

## 5. Tests and Verification

- [x] 5.1 Add DAL/integration tests for successful `Postpone` and `Return Merchant` decisions and their side effects.
- [x] 5.2 Add server action unit tests for authorization, validation, stale-dialog rejection, revalidation, and success responses.
- [x] 5.3 Add component tests for the warning icon, failure note dialog, and button behavior.
- [x] 5.4 Add or update E2E coverage for an admin reviewing a rider failure note and resolving it.
- [x] 5.5 Run lint, typecheck, and the relevant unit/integration/E2E test suites.
  - Verified with targeted oxlint for changed parcel/E2E files, `bun run typecheck`, `bun run test:unit`, direct integration test run against local Supabase, and `bun run test:e2e`.
  - Repository-wide `bun run lint` still reports pre-existing unrelated test lint issues outside this change.
