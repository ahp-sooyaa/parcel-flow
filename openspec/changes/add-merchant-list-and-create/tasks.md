## 1. Data Model and Authorization Foundations

- [x] 1.1 Add merchant database schema changes for merchant profile fields (`name`, optional `phone`, `address`, `township`, optional `notes`, optional linked app user id) with timestamps and supporting indexes for lookup.
- [x] 1.2 Add constraints and relationship rules for optional merchant-to-app-user linkage to support future merchant login without requiring linked user at creation.
- [x] 1.3 Define and wire permission checks for merchant operations (`merchant:list`, `merchant:create`, and self-scope detail rule placeholder) in server-side authorization paths.

## 2. Merchant Server Layer (Feature-Sliced)

- [x] 2.1 Create `src/features/merchant/server/dal.ts` with explicit queries for paginated merchant listing, search by name/phone, and merchant creation.
- [x] 2.2 Create `src/features/merchant/server/dto.ts` to shape safe merchant list/detail response payloads and avoid exposing unnecessary fields.
- [x] 2.3 Create `src/features/merchant/server/utils.ts` for feature helpers (query normalization, deterministic ordering helpers, and permission helper wrappers).
- [x] 2.4 Create `src/features/merchant/server/actions.ts` server actions for merchant create mutation with zod validation and allowlisted write mapping.

## 3. Merchant List and Create UI Flows

- [x] 3.1 Build merchant list page under `src/app` + `src/features/merchant/components` for internal staff browse/search workflow.
- [x] 3.2 Build merchant create page/form under `src/app` + `src/features/merchant/components` with clean form structure and explicit field-level validation messaging.
- [x] 3.3 Connect list/create UI to server actions and DAL results without placing business logic or raw DB access in client components.
- [x] 3.4 Add authorization-aware route behavior so unauthorized users are denied and merchant-role users are blocked from merchant list.

## 4. Validation, Security, and Verification

- [x] 4.1 Add tests for merchant create server validation (required fields, optional phone, optional notes, unknown field rejection/ignore behavior per policy).
- [x] 4.2 Add tests for authorization boundaries: staff/admin allowed for list/create, non-authorized users denied, merchant-role list access denied.
- [x] 4.3 Add tests for merchant list search behavior and deterministic ordering for operational lookup.
- [x] 4.4 Perform end-to-end internal flow verification for staff: create merchant then find merchant quickly from list search.
