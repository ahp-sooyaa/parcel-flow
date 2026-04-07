## Context

The current implementation stores person-level data in multiple places:

- `app_users` stores shared account data such as full name, email, phone, role, and active status.
- `merchants` still stores merchant person/contact fields such as `name` and `phone_number`, plus an optional `linked_app_user_id`.
- `riders` still stores rider person/contact fields such as `full_name` and `phone_number`, plus an optional `linked_app_user_id`.

This shape no longer matches the updated database diagram. The desired model is:

- `app_users` is the shared human/account table.
- `merchants` is a required 1:1 business profile keyed by `app_user_id`.
- `riders` is a required 1:1 rider profile keyed by `app_user_id`.
- Merchant-role and rider-role user creation happen from the user create flow, which also creates the profile row with sensible defaults when role-specific optional fields are omitted.

This change is cross-cutting because it affects schema, migrations, auth joins, DTO shaping, create forms, list/detail queries, and provisioning logic. It also has migration risk because legacy merchant and rider rows may not yet align to the new ownership model.

## Goals / Non-Goals

**Goals:**

- Make `app_users` the single source of truth for shared user identity and contact data.
- Convert `merchants` and `riders` into business/operational profile tables with required 1:1 ownership by app user.
- Move merchant-role and rider-role onboarding into the existing user create workflow.
- Add a small township master table and basic township management pages in the dashboard.
- Keep migration and application behavior auditable, explicit, and safe to review.
- Generate a new Drizzle migration from schema changes without editing existing migration files.

**Non-Goals:**

- Changing role definitions, permission assignments, or authorization policy structure.
- Refactoring parcel, payout, settlement, or bank-account tables in this round.
- Designing public signup or self-service onboarding.
- Introducing repository/service abstraction layers beyond the existing feature-sliced server modules.

## Decisions

### 1. Use `app_users.id` as the canonical owner key for merchant and rider profiles

`merchants` and `riders` will move from surrogate primary keys plus optional `linked_app_user_id` to a required `app_user_id` relationship. The preferred implementation is to make `app_user_id` the primary key for both tables so the data model enforces one profile per user directly.

Rationale:

- It matches the updated ERD.
- It removes ambiguity between profile row identity and owning user identity.
- It simplifies self-scope joins and prevents orphaned role-profile rows.

Alternative considered:

- Keep separate profile `id` columns and add a unique `app_user_id`.
- Rejected because it preserves an unnecessary second identifier for a strict 1:1 table and increases join complexity without clear benefit in this phase.

### 2. Keep shared human/contact fields only in `app_users` and normalize township references

`full_name`, `email`, and `phone_number` remain on `app_users`. Merchant-specific and rider-specific tables will only keep fields unique to those domains.

Target table intent:

- `app_users`: shared identity/account fields
- `townships`: small master table for township name and active status
- `merchants`: `shop_name`, `pickup_township_id`, `default_pickup_address`, `notes`
- `riders`: `vehicle_type`, `license_plate`, `is_active`, `township_id` if rider service/base township is still needed in this phase, plus rider-specific fields that are not duplicates of shared account state

Rationale:

- Avoids duplicated edits and inconsistent reads.
- Makes the user create flow the natural place to capture shared human data.
- Fits future auth and accounting flows where a person has one account identity but a role-specific profile.

Alternative considered:

- Keep duplicated display fields on merchant/rider tables for convenience.
- Rejected because it recreates the drift problem this refactor is meant to remove.

Alternative considered:

- Keep township as a static string constant list for one more round.
- Rejected because the team wants the township table now, the table is small, and merchant/rider forms would otherwise need another contract change soon after this refactor.

### 3. Provision role-specific profiles inside the admin user creation workflow

When an admin creates a user:

- All roles create a Supabase auth user and an `app_users` row.
- If role is `merchant`, the workflow also creates the merchant profile row in the same server-side orchestration.
- If role is `rider`, the workflow also creates the rider profile row in the same server-side orchestration.

Defaulting rules from the updated diagram:

- Merchant `shop_name` defaults to the created app user's full name if the field is omitted.
- Rider `vehicle_type` defaults to `bike` if the field is omitted.
- Other role-specific optional fields remain `null` when not provided.

Rationale:

- It matches the requested UX and removes duplicate create flows.
- It keeps admin provisioning as one auditable unit.
- It reduces the chance of creating an account without the required role profile.

Alternative considered:

- Keep separate merchant and rider create pages and only sync schema.
- Rejected because the desired workflow change is part of the business request and the old UX would continue to produce avoidable inconsistency.

### 4. Keep rider operational active state separate from app-user active state

`riders.is_active` will remain separate from `app_users.is_active` and will default to `true`.

Rationale:

- Account activation and rider operational activation serve different business concerns.
- The user explicitly wants to preserve this distinction in the new schema.

Alternative considered:

- Remove `riders.is_active` and derive all rider activation from `app_users.is_active`.
- Rejected because it collapses account access state and rider operational availability into one flag.

### 5. Use compensating cleanup for partial provisioning failures

The provisioning sequence spans Supabase auth plus one or more database writes. The flow should:

1. Create the Supabase auth user.
2. Insert the `app_users` row.
3. Insert the role-specific profile row when required.
4. If any application-database step fails after Supabase user creation, delete the newly created Supabase user and abort.

Where possible, the database inserts should run in a single transaction after the Supabase user is created.

Rationale:

- Full distributed transactions are not available across Supabase Auth and Postgres writes.
- Explicit cleanup is simple, boring, and consistent with the current user creation pattern.

Alternative considered:

- Accept partial creation and repair manually.
- Rejected because it leaves broken account state and weakens operational clarity.

### 6. Treat legacy merchant and rider rows as migration cleanup, not runtime fallbacks

The migration should reshape existing rows rather than teaching the application to support both old and new schemas long term.

Migration expectations:

- Add the new ownership, township, and profile columns.
- Because there is no production data to preserve, clear existing merchant and rider rows before applying or validating the final required ownership constraints.
- Remove obsolete columns and constraints once the new schema is in place.

Rationale:

- A temporary dual-read model would complicate every query and DTO.
- The requested change is structural, so the database should be brought into a single coherent state.

Alternative considered:

- Support both legacy and new columns in app code for one or more releases.
- Rejected because it increases application complexity and delays cleanup without clear product value.

### 7. Add simple township management without expanding authorization scope

This round will add township list and create pages plus a sidebar menu entry. The township sidebar entry will be visible without introducing new authorization gating for now.

Rationale:

- The user wants the township area available immediately.
- The permission model for this section can be refactored later with the broader authorization work.

Alternative considered:

- Delay township UI until a dedicated authorization design exists.
- Rejected because the user explicitly wants the township CRUD entry points in this refactor.

### 8. Preserve authorization behavior and limit this round to data-shape alignment

This round will not redefine permission slugs, role capabilities, or ownership rules beyond what the new schema requires for correct joins. Any broader permission or authorization refactor remains a follow-up change.

Rationale:

- The user explicitly excluded permission refactors.
- Separating concerns lowers delivery risk and makes review easier.

## Risks / Trade-offs

- [Legacy merchant or rider rows without a linked app user] → Audit current data before rollout; if such rows exist, decide whether to create linked users, manually map them, or block migration until cleaned.
- [Township normalization changes multiple forms and lists at once] → Update schema, DAL, DTO, and form option loading together so merchant, rider, and township pages use one source of truth.
- [Sidebar link is visible before fine-grained authorization exists] → Keep server-side authorization decisions explicit on mutation routes later; document that menu visibility is intentionally broad in this round.
- [Schema change breaks joins or self-scope resolution] → Update auth, merchant, and rider DAL/DTO code together and verify role-specific list/detail flows against seeded data.
- [Provisioning creates Supabase user but fails during profile insert] → Keep compensating delete behavior and log audit/error context for operators.
- [Removing separate create pages disrupts staff workflow] → Update navigation and user-create UX in the same release so merchant/rider onboarding still has a clear entry point.
- [Generated migration may need careful review for destructive steps] → Inspect the generated Drizzle migration before applying and verify it copies data before dropping old columns.

## Migration Plan

1. Update `src/db/schema.ts` to the new table shape, including the township master table, without touching existing migration files.
2. Generate a new Drizzle migration from the schema diff.
3. Review the generated SQL for township table creation, ownership constraints, indexes, and obsolete column removals.
4. Clear existing merchant and rider rows in the target environment before enforcing the final new schema, since there is no production data to preserve.
5. Apply the migration in a non-production environment.
6. Update application queries, DTOs, and actions to read/write the new schema only.
7. Replace the current user create contract and form with role-aware merchant/rider sections that load township options from the township table.
8. Add township list/create pages and the sidebar navigation entry.
9. Remove standalone merchant/rider create entry points once the unified flow is working.
10. Validate user, merchant, rider, and township flows plus role-scoped reads.

Rollback strategy:

- Before production rollout, take a database backup.
- If deployment fails before migration is applied everywhere, revert the application code and do not apply the new migration.
- If migration is applied and a critical issue is found, restore from backup rather than attempting ad hoc schema reversal in production.

## Open Questions

None for this proposal revision.
