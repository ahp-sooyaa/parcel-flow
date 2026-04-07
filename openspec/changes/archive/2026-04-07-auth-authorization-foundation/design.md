## Context

Parcel Flow is an internal operations app with financial and delivery data, so access control errors are high-risk. The app uses a full-stack Next.js monolith with feature-sliced modules and Supabase Auth for identity. Current requirements mandate sign-in only (no public signup), admin-created users, one role per user in v1, and authorization enforcement at proxy, UI, and server action layers. The design must keep logic explicit and auditable, avoid overengineering, and fit the existing project structure.

## Goals / Non-Goals

**Goals:**
- Implement a clear separation between identity (Supabase Auth) and authorization (app DB roles/permissions).
- Define Drizzle schema for users, roles, permissions, and role-permission relationships with explicit status fields and phone contact data.
- Provide deterministic sync between Supabase user identity and app user records.
- Enforce fail-closed authorization in `proxy.ts`, server actions, and UI guard components.
- Support admin-only user creation with strong generated passwords and `must_reset_password = true`.
- Support admin-assisted password reset and self-service password change for authenticated users.
- Seed one super admin safely for first bootstrap.

**Non-Goals:**
- Multi-role users (future iteration).
- Self-service registration or invite flow.
- Complex ABAC/policy engine.
- OTP, SMS verification, phone-based login, and phone-based password reset.
- Email-based forgot-password flow in v1.
- Full feature-level permission rollout for all domains beyond a minimal first permission set.

## Decisions

1. Source of truth split: Supabase for identity, app DB for authorization and status
- Decision: Keep credentials and sessions in Supabase Auth, while roles, permissions, active/inactive status, and must-reset-password flag live in app DB tables.
- Rationale: Aligns with security best practice and avoids trusting identity provider custom claims for mutable business authorization.
- Alternative considered: Put role/permission in Supabase metadata only. Rejected because it is less auditable, harder to query relationally, and less controlled for server-enforced checks.

2. Single-role model in v1 with normalized permission mapping
- Decision: `app_users` references one `roles` row; permissions are checked via `role_permissions` join against `permissions`.
- Rationale: Meets requirement "one user has one role" while preserving a scalable path to multi-role later.
- Alternative considered: hard-coded role switch statements in code. Rejected because it is brittle and harder to audit as permissions evolve.

3. Deterministic user provisioning by authorized admins only
- Decision: Super admin/authorized admin creates users via server action that:
  - validates input with zod,
  - generates strong random password server-side,
  - creates Supabase user using admin API,
  - upserts `app_users` row with assigned role, `is_active`, `must_reset_password = true`, and `phone_number`.
- Rationale: Ensures explicit onboarding flow and no public signup path.
- Alternative considered: manual creation in Supabase dashboard. Rejected as non-repeatable, less auditable, and operationally risky.

4. Email login required, phone contact only in v1
- Decision: Keep email required for Supabase Auth login and store `phone_number` in app user records for contact and operations context.
- Rationale: Matches Myanmar operating reality while keeping authentication model simple and secure in the first iteration.
- Alternative considered: phone-based auth/OTP now. Rejected due to added infrastructure and security complexity not required for v1.

5. Current-user context loader as shared server utility
- Decision: Implement a single server-side loader that resolves authenticated Supabase user ID to app user profile, role, and flattened permission set for request lifecycle use.
- Rationale: Centralizes authorization context and avoids inconsistent checks across features.
- Alternative considered: each feature queries independently. Rejected due to duplicated logic and drift risk.

6. Fail-closed route protection in `proxy.ts`
- Decision: Add auth guard in `proxy.ts` for dashboard routes:
  - unauthenticated users redirect to sign-in,
  - authenticated but unauthorized/inactive users redirect to `/unauthorized`,
  - only allowed routes continue.
- Rationale: Earliest enforcement point for UX and security consistency.
- Alternative considered: page-level guards only. Rejected because users could still hit protected routes and cause inconsistent behavior.

7. Defense in depth: proxy + UI + server action checks
- Decision: Require all three layers:
  - `proxy.ts` for route-level guard,
  - `IfPermitted` for conditional UI exposure,
  - server action `requirePermission()` checks before mutation.
- Rationale: Prevent privilege escalation when UI is bypassed and maintain clarity of allowed actions.
- Alternative considered: UI-only checks. Rejected as insecure.

8. Admin-assisted reset and self password change in v1
- Decision: Do not implement email-based forgot-password in v1. Instead:
  - authorized admins reset user passwords from `/dashboard/users/*`,
  - system generates strong temporary passwords server-side,
  - Supabase password is updated and `must_reset_password = true` is set in app DB,
  - temporary password is shown once to admin and never stored in app tables,
  - logged-in users can change their own password at `/dashboard/profile`.
- Rationale: Supports operations immediately without introducing external mail/SMS reset dependencies.
- Alternative considered: standard email reset links. Rejected for v1 due to reliability and operational control requirements.

9. Limited-access flow for `must_reset_password = true`
- Decision: Allow dashboard entry when `must_reset_password = true` but restrict normal/sensitive actions and show clear warning banner until password is changed.
- Rationale: Meets requirement for forced flow without hard pre-dashboard blocking.
- Alternative considered: dedicated forced reset page that blocks dashboard entry. Rejected for v1.

10. Minimal first permission set with explicit slugs
- Decision: Seed permission slugs (example):
  - `users.create`
  - `users.read`
  - `users.update_status`
  - `user:reset_password`
  - `profile.view_self`
  - `profile.update_self`
  - `profile.change_password_self`
  - `dashboard.view`
  - `parcels.read_assigned`
  - `merchant_portal.view_self`
- Rationale: Small auditable set to unlock initial app access patterns.
- Alternative considered: broad wildcard permissions. Rejected due to weak auditability and over-privileging.

11. Super admin bootstrap via idempotent seed script
- Decision: Add seed script that ensures roles/permissions baseline exists, then ensures one configured super admin identity is present and linked in `app_users`.
- Rationale: Repeatable setup across environments and safer recovery from partial setup.
- Alternative considered: one-time SQL file without checks. Rejected due to fragility and unclear rerun behavior.

## Risks / Trade-offs

- [Risk] Supabase user exists but app user record fails to create in same flow -> Mitigation: use compensating action (delete created auth user) or explicit retry-safe reconciliation path and audit logs.
- [Risk] Permission checks are added inconsistently across server actions -> Mitigation: enforce a shared `requirePermission` helper and code review checklist.
- [Risk] Role-permission mapping mistakes can block legitimate access -> Mitigation: seed defaults with tests and keep mapping explicit in versioned migration/seed files.
- [Risk] Inactive user handling may be inconsistent between layers -> Mitigation: centralize status check inside auth context loader used by both proxy and server utilities.
- [Risk] Temporary admin-reset password exposure in logs/UI state -> Mitigation: one-time display response, masked rendering by default, and no persistence in DB logs/tables.
- [Trade-off] Single-role design simplifies v1 but limits nuanced access patterns -> Mitigation: schema remains extendable for future user-role join table.

## Migration Plan

1. Add Drizzle schema + migration for roles, permissions, role_permissions, app_users (including `phone_number` contact field).
2. Add seed data for roles and minimal permission set.
3. Add idempotent super admin bootstrap script using environment-provided identity values.
4. Add auth context loader + permission helpers.
5. Integrate `proxy.ts` route protection and unauthorized redirect behavior.
6. Add `/dashboard/profile` self-account page for own info updates and own password change.
7. Add `IfPermitted` for UI-level authorization and limited-access gating when `must_reset_password = true`.
8. Add server action authorization wrapper/check helper and apply to user provisioning and admin-assisted password reset actions.
9. Validate with integration checks: super admin create user, admin password reset one-time reveal, rider/merchant login, inactive-user block, unauthorized route/action deny.

Rollback strategy:
- Revert app usage to maintenance mode if auth guard misconfiguration blocks access.
- Roll back migration and seed only before production data dependence; after adoption, use forward-fix migration strategy.

## Auth/Account Flow Plan

1. User signs in with email + password via Supabase Auth.
2. Server resolves app user context (role, permissions, status, must-reset flag, phone contact).
3. `proxy.ts` protects only `/dashboard/*`; unauthenticated users are redirected to sign-in and unauthorized users to `/unauthorized`.
4. If `must_reset_password = true`, user can enter dashboard with warning banner and restricted sensitive actions until password change.
5. User changes own password from `/dashboard/profile`, which clears reset-required state.
6. Forgot-password requests are handled operationally by authorized admin reset from user management in v1.

## Schema Proposal

- `app_users` (key fields): `id`, `supabase_user_id`, `email`, `phone_number`, `role_id`, `is_active`, `must_reset_password`, timestamps.
- `roles`: fixed seed set for `super_admin`, `office_admin`, `rider`, `merchant`.
- `permissions`: seeded minimal permissions including reset and profile/self scopes.
- `role_permissions`: explicit mapping table from roles to permission slugs.
- Temporary passwords are never stored in application tables.

## Page/Route Plan

- Protected dashboard area: `/dashboard/*`.
- Self account page: `/dashboard/profile`.
- User management pages remain under `/dashboard/users/*`.
- Admin-assisted password reset is an action on user detail/edit pages (for example `/dashboard/users/[id]` or `/dashboard/users/[id]/edit`).
- No standalone admin reset-password management page in v1.

## Permission List (First Iteration)

- `dashboard.view`
- `users.create`
- `users.read`
- `users.update_status`
- `user:reset_password`
- `profile.view_self`
- `profile.update_self`
- `profile.change_password_self`
- `parcels.read_assigned`
- `merchant_portal.view_self`

## User-Management Flow

1. Authorized admin creates user with email, phone contact, role, and active/inactive status.
2. System generates strong initial password, creates Supabase identity, sets `must_reset_password = true`, and returns temporary credential once.
3. Authorized admin can reset password from user management pages using `user:reset_password`.
4. Reset action generates a new strong temporary password, updates Supabase password, sets `must_reset_password = true`, and displays temporary password once.
5. `office_admin` remains limited in first iteration per agreed restrictions and cannot escalate or alter protected super-admin controls.
