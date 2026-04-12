## 1. Database Schema And Baseline Data

- [x] 1.1 Add Drizzle tables for `roles`, `permissions`, `role_permissions`, and `app_users` with one-role-per-user structure, `phone_number` contact field, and explicit audit fields.
- [x] 1.2 Create and apply migration for the auth/authorization schema changes.
- [x] 1.3 Implement baseline seed for roles (`super_admin`, `office_admin`, `rider`, `merchant`) and minimal first permission set including `user:reset_password`.
- [x] 1.4 Implement role-permission mapping seed for first iteration access policy.

## 2. Supabase Identity And App User Synchronization

- [x] 2.1 Add server-side auth context loader that resolves Supabase user identity to app user, role, active status, and permission set.
- [x] 2.2 Add fail-closed behavior for missing app-user mapping and inactive users in shared auth utilities.
- [x] 2.3 Add typed permission check utilities (`hasPermission`, `requirePermission`) for shared server use.

## 3. User Provisioning And Super Admin Bootstrap

- [x] 3.1 Implement admin-only server action for user creation with zod validation and explicit allowlisted fields including `phone_number`.
- [x] 3.2 Generate strong passwords server-side during provisioning and set `must_reset_password = true` on created users.
- [x] 3.3 Support creating users as active or inactive with explicit persisted status.
- [x] 3.4 Implement idempotent super admin bootstrap seed flow that creates/links exactly one initial super admin.
- [x] 3.5 Implement admin-assisted password reset action under `/dashboard/users/*` with `user:reset_password` authorization.
- [x] 3.6 Ensure admin-assisted reset generates strong temporary password, updates Supabase password, sets `must_reset_password = true`, and never stores plaintext temporary password in app tables.
- [x] 3.7 Ensure temporary reset password is returned for one-time authorized admin display only.

## 4. Authorization Enforcement Across Layers

- [x] 4.1 Add route protection in `src/proxy.ts` for protected dashboard routes with redirects for unauthenticated and unauthorized users.
- [x] 4.2 Add/extend `IfPermitted` shared component for UI-level permission gating using current-user context.
- [x] 4.3 Apply `requirePermission` checks to protected server actions to prevent UI bypass privilege escalation.

## 5. Protected Shell And Auth UX Baseline

- [x] 5.1 Ensure protected dashboard shell includes sidebar navigation and logout for authorized sessions.
- [x] 5.2 Ensure unauthorized users are routed to `/unauthorized` page and cannot access protected content.
- [x] 5.3 Ensure rider and merchant users can sign in with admin-created credentials and reach only permitted areas.
- [x] 5.4 Add `/dashboard/profile` for self account viewing, allowed profile edits, and own password change.
- [x] 5.5 Add reset-required warning/banner and enforce limited-access restrictions when `must_reset_password = true`.
- [x] 5.6 Ensure no email-based forgot-password, OTP, SMS verification, or phone-based login/reset flows are exposed in first iteration.

## 6. Verification And Security Checks

- [x] 6.1 Add tests or verification scripts for role-permission mapping, inactive user blocking, and server action authorization failures.
- [x] 6.2 Verify no public signup path is exposed in UI or server routes.
- [x] 6.3 Verify provisioning and authorization flows are auditable via explicit logs/events for critical auth actions.
- [x] 6.4 Verify admin reset temporary passwords are never persisted and are one-time-display only.
- [x] 6.5 Verify `office_admin` restrictions align with agreed limited user-management capabilities.
