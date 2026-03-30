## Why

Parcel Flow needs a secure, auditable auth and authorization foundation before more operational features are added. Right now, we need a single explicit model that enforces least privilege across routing, UI, and server mutations with admin-controlled user provisioning.

## What Changes

- Add Supabase sign-in only authentication flow with no public signup.
- Keep email required for Supabase Auth login and add `phone_number` as an app contact field.
- Keep phone as contact-only in v1 (no OTP, no SMS verification, no phone-based login or reset).
- Define app-level roles and permissions in the application database (separate from identity provider claims).
- Add admin-only user provisioning flow that creates Supabase users with generated strong passwords and `must_reset_password = true`.
- Add admin-assisted password reset from user management that generates one-time temporary credentials without storing temporary passwords in app tables.
- Seed one initial super admin account and role assignment.
- Add active/inactive user status support and enforce inactive login blocking at app authorization layer.
- Add current-user auth context loader that resolves Supabase identity to app user + role + permissions.
- Enforce authorization in `proxy.ts`, UI permission gates (`IfPermitted`), and server actions.
- Add protected dashboard shell with sidebar + logout as the default authenticated app entry.
- Add `/dashboard/profile` for self account info, editable profile fields, and own-password change.
- Use limited-access mode when `must_reset_password = true` with warning banner and restricted sensitive actions until password is changed.
- Add minimal first permission set to support user provisioning and role-constrained dashboard access.

## Capabilities

### New Capabilities
- `auth-foundation`: Supabase-backed sign-in session integration, protected shell routing, current-user context loading, and logout behavior.
- `authorization-foundation`: App database role/permission model, permission checks, server/UI/proxy authorization enforcement, and inactive-user access blocking.
- `admin-user-provisioning`: Admin-only user creation with generated credentials, initial status setup, role assignment, admin-assisted password reset, and super admin seeding.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/proxy.ts`
  - `src/app/(dashboard)/**`
  - `src/components/layout/**`
  - `src/components/shared/**` (including `IfPermitted`)
  - `src/features/auth/**`
  - `src/features/users/**`
  - `src/features/profile/**`
  - `src/db/**` (Drizzle schema + migration + seed)
  - `src/lib/**` (auth/session utilities)
- Data model impact:
  - New tables for app users, roles, permissions, role-permission mappings, and user-role assignment (single role per user in v1).
  - User status, `must_reset_password`, and `phone_number` contact data stored in app DB for explicit auditing.
- Security impact:
  - Fail-closed access enforcement across edge routing, UI rendering, and mutations.
  - Server-side authorization checks become mandatory for all protected actions.
  - Temporary admin-generated passwords are never persisted in application tables and are displayed once only.
- Operational impact:
  - Only authorized admins can onboard users.
  - Rider and merchant users can log in only when created and active.
