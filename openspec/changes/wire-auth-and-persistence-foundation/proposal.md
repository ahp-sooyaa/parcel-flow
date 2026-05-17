## Why

Parcel Flow currently uses mock data and validation-only server actions, so the existing UI cannot support real users, persisted operational data, or protected role-based access. This change wires the MVP foundation to Better Auth, Supabase PostgreSQL, and Drizzle for Phase 1 and Phase 2, while including rider assignment because the parcel UI already exposes that workflow.

## What Changes

- Configure Better Auth as the canonical user model for Parcel Flow users; do not create a separate `app_users` domain table.
- Support admin-created accounts with username and password login, no public signup, no OTP login, no email login UI, and no phone verification flow in MVP.
- Generate unique usernames and internal Better Auth emails from the entered user name during account creation.
- Replace development demo-session behavior with real session loading, a first-super-admin seed script, and explicit route protection for dashboard pages.
- Persist users, merchant profiles, rider profiles, rider service townships, bank accounts, townships, and parcel records through Drizzle against Supabase PostgreSQL.
- Replace mock DAL arrays and validation-only server actions for Phase 1 and Phase 2 screens with real database reads and mutations.
- Standardize form implementation: `useActionState` for simple controlled server-action forms and React Hook Form plus server actions for complex controlled forms.
- Persist parcel creation with unique parcel code generation, default parcel statuses, pricing fields, and created-by audit data.
- Persist rider assignment for one or more parcels by setting `rider_id` and `assigned_at` while keeping each parcel's current status unchanged.
- Enforce role and ownership checks server-side for admin, merchant, and rider data access.
- Keep parcel status progression, delivery side effects, financial item generation, merchant settlements, and rider payouts out of this change except where existing list pages need read-only placeholders or empty persisted data.

## Capabilities

### New Capabilities

- `auth-session-access`: Better Auth account creation, username-password login, generated internal email, sessions, route protection, role fields, and password reset requirements.
- `persisted-user-management`: Persisted CRUD for users, merchant/rider profiles, rider service townships, bank accounts, and self account settings.
- `persisted-township-settings`: Persisted CRUD for township delivery pricing/settings used by parcel creation.
- `persisted-parcel-intake`: Persisted parcel creation and listing with role-scoped visibility, unique parcel codes, default payment/status fields, and delivery fee inputs.
- `parcel-rider-assignment`: Persisted rider assignment from the existing parcel UI, including assignment timestamps, rider visibility, and expected collection summary data.

### Modified Capabilities

- None.

## Impact

- Affects `src/lib/auth.ts`, `src/lib/session.ts`, `src/proxy.ts`, and auth API/session behavior.
- Affects `src/db/schema.ts`, Drizzle migrations, and Supabase PostgreSQL setup.
- Affects feature DAL/action files under `src/features/users`, `src/features/townships`, `src/features/parcels`, `src/features/merchants`, and `src/features/riders`.
- Affects dashboard page data loading and client form success flows where persisted mutations must refresh server data.
- May require adding React Hook Form for complex controlled form state.
- Requires updated environment variable handling for real local and deployed database/auth configuration.
- Requires lint, typecheck, migration generation, and database-backed smoke verification before implementation is considered complete.
