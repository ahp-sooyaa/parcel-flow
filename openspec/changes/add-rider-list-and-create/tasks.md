## 1. Data Model and Migration

- [x] 1.1 Add `riders` table definition, indexes, and inferred types in `src/db/schema.ts` following existing merchant/app-user patterns.
- [x] 1.2 Generate Drizzle migration from schema changes and run migration using project workflow (no manual SQL authoring).
- [x] 1.3 Validate that rider-to-app-user uniqueness and required columns match spec expectations.

## 2. Rider Server Feature Layer

- [x] 2.1 Create `src/features/rider/server/dto.ts` with rider list/create action result DTOs and safe response-shaping helpers.
- [x] 2.2 Create `src/features/rider/server/utils.ts` with zod schema and rider search normalization helpers.
- [x] 2.3 Create `src/features/rider/server/dal.ts` for rider list query, rider creation write, linked-user lookup checks, and linkable rider-user query.
- [x] 2.4 Create `src/features/rider/server/actions.ts` to enforce `rider.create`, parse/validate form input, call DAL, log audit event, and revalidate riders route.

## 3. Rider UI and Routes

- [x] 3.1 Replace placeholder `src/app/(dashboard)/dashboard/riders/page.tsx` with list page implementation gated by `rider-list.view` and search behavior.
- [x] 3.2 Add `src/app/(dashboard)/dashboard/riders/create/page.tsx` with permission gate and rider create form wiring.
- [x] 3.3 Add `src/features/rider/components/create-rider-form.tsx` using server action state handling and explicit fields.
- [x] 3.4 Ensure township input uses current static list (no township table dependency) and aligns with approved scope.

## 4. Security, Consistency, and Verification

- [x] 4.1 Ensure server-side authorization and fail-closed behavior for rider list/create paths (no client-trusted role data).
- [x] 4.2 Ensure linked app user validation prevents missing-user and duplicate-link rider creation cases.
- [x] 4.3 Verify audit log metadata and route revalidation behavior after successful rider creation.
- [x] 4.4 Run project checks/tests for touched scope and resolve any regressions before marking complete.
