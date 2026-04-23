## Why

The app currently stops at user creation and read-only detail views, which leaves administrators unable to correct identity or role-profile data and leaves rider users without the same self-service detail access that merchant users already have. We need a consistent, server-authorized edit and soft-delete workflow now so user records stay accurate, role-linked profiles remain auditable, and deleted records are preserved instead of being lost.

## What Changes

- Add administrative edit flows for shared app user profile fields such as full name and phone number from the users list area and the profile-related detail flows.
- Add super-admin-only soft-delete flows for app users and their linked merchant or rider profile records by writing `deleted_at`, hiding soft-deleted records from normal UI queries, and recording audit logs.
- Add role-aware edit support so super admins and office admins can edit merchant and rider business or operational profile fields from the users management area and the dedicated merchant or rider edit pages.
- Add self-service merchant and rider profile editing from their respective detail edit routes, while keeping self-scope restricted to each logged-in user’s own record.
- Expand the dashboard profile experience so super admins and office admins can update user profile data there, while merchant and rider users keep profile-page access for shared identity fields only.
- Add rider self-navigation to the dashboard shell so rider users can reach their own rider detail and edit pages the same way merchant users can reach their own merchant detail.
- Update route guards, DAL queries, DTO shaping, and sidebar DTO generation so edit and soft-delete actions are enforced on the server and only expose fields allowed for the acting role.
- Keep delete authority restricted to super admins, while extending the seeded permission matrix only as needed for non-destructive update workflows.

## Capabilities

### New Capabilities
- `user-account-management`: manage app user profile edits, guarded soft deletion, and linked role-profile maintenance from the dashboard users workflows.
- `profile-self-service`: edit shared self profile fields from `/dashboard/profile`, with role-aware routing into merchant or rider profile maintenance where applicable.
- `merchant-management`: support merchant profile editing from admin-managed and merchant self-service routes using server-enforced scope checks.
- `rider-management`: support rider profile editing from admin-managed and rider self-service routes using server-enforced scope checks.
- `dashboard-shell-navigation`: expose rider self-navigation alongside the existing merchant self-navigation pattern.

### Modified Capabilities

## Impact

- Affected users feature files under [`src/features/users`](/Users/aunghtet/Personal/parcel-flow/src/features/users), including server actions, DAL queries, DTOs, and new edit/delete form components
- Affected schema and generated migration output under [`src/db/schema.ts`](/Users/aunghtet/Personal/parcel-flow/src/db/schema.ts) and [`src/db/migrations`](/Users/aunghtet/Personal/parcel-flow/src/db/migrations) to add `deleted_at` support for soft deletion
- Affected profile feature files under [`src/features/profile`](/Users/aunghtet/Personal/parcel-flow/src/features/profile), especially self-profile editing actions and UI
- Affected merchant feature files under [`src/features/merchant`](/Users/aunghtet/Personal/parcel-flow/src/features/merchant) and rider feature files under [`src/features/rider`](/Users/aunghtet/Personal/parcel-flow/src/features/rider)
- Affected dashboard routes under [`src/app/(dashboard)/dashboard/users`](/Users/aunghtet/Personal/parcel-flow/src/app/(dashboard)/dashboard/users), [`src/app/(dashboard)/dashboard/merchants`](/Users/aunghtet/Personal/parcel-flow/src/app/(dashboard)/dashboard/merchants), [`src/app/(dashboard)/dashboard/riders`](/Users/aunghtet/Personal/parcel-flow/src/app/(dashboard)/dashboard/riders), and [`src/app/(dashboard)/dashboard/profile`](/Users/aunghtet/Personal/parcel-flow/src/app/(dashboard)/dashboard/profile)
- Affected auth/session navigation shaping in [`src/features/auth/server/dto.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/auth/server/dto.ts), current-user authorization helpers in [`src/features/auth/server/utils.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/auth/server/utils.ts), and dashboard shell layout in [`src/components/layout/dashboard-shell.tsx`](/Users/aunghtet/Personal/parcel-flow/src/components/layout/dashboard-shell.tsx)
- Affected permission constants and seed expectations in [`src/db/constants.ts`](/Users/aunghtet/Personal/parcel-flow/src/db/constants.ts) and related auth verification seed scripts
