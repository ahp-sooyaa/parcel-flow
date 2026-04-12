## Why

The current schema duplicates human identity and contact fields across `app_users`, `merchants`, and `riders`, which no longer matches the updated database design and makes provisioning logic harder to reason about. We need to realign the schema and create flows now so future parcel, payout, settlement, and self-scope features build on a single auditable source of truth for user identity.

## What Changes

- Refactor `app_users` to remain the shared identity/account table for all authenticated users.
- Refactor `merchants` into a 1:1 merchant profile table keyed by the related app user, storing only merchant business profile fields.
- Refactor `riders` into a 1:1 rider profile table keyed by the related app user, storing only rider operational profile fields.
- Add a `townships` master table in this refactor and migrate merchant and rider township references to database-backed township records.
- **BREAKING** Replace the current optional `linked_app_user_id` pattern with required 1:1 ownership from `merchants.app_user_id` and `riders.app_user_id`.
- **BREAKING** Remove duplicate name and phone fields from `merchants` and `riders`; keep shared human/contact data in `app_users`.
- Change admin user provisioning so merchant-role and rider-role user creation can create the matching profile row in the same workflow.
- Change the user create form to show merchant-specific or rider-specific fields when those roles are selected, and stop relying on separate create pages as the primary onboarding flow for those roles.
- Add township list and create pages backed by the township table.
- Add a `townships` entry in the dashboard sidebar and keep that navigation entry outside authorization checks for now.
- Preserve the current permission and authorization model for this round; this proposal explicitly excludes permission refactors.
- Implement the schema change through new Drizzle schema updates and a newly generated migration, without modifying existing migration files.

## Capabilities

### New Capabilities

- `township-management`: maintain township master data through internal list and create pages backed by the township table.

### Modified Capabilities

- `admin-user-provisioning`: user creation must support role-specific merchant and rider profile creation in the same server-side provisioning flow.
- `dashboard-shell-navigation`: the dashboard sidebar must expose a township section entry in this round without adding authorization-based menu gating for that entry yet.
- `merchant-management`: merchant creation and merchant data access must align to a required 1:1 merchant profile owned by an app user, with business-only merchant fields.
- `rider-management`: rider creation and rider data access must align to a required 1:1 rider profile owned by an app user, with rider-only operational fields.

## Impact

- Affected database code: [`src/db/schema.ts`](/Users/aunghtet/Personal/parcel-flow/src/db/schema.ts), generated Drizzle migration output under [`src/db/migrations`](/Users/aunghtet/Personal/parcel-flow/src/db/migrations)
- Affected township data and dashboard areas: new township feature slice under `src/features/townships/*`, dashboard routes under `src/app/(dashboard)/dashboard/townships/*`, and sidebar layout components under [`src/components/layout`](/Users/aunghtet/Personal/parcel-flow/src/components/layout)
- Affected user provisioning flow: [`src/features/users/server/actions.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/users/server/actions.ts), [`src/features/users/server/utils.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/users/server/utils.ts), [`src/features/users/components/create-user-form.tsx`](/Users/aunghtet/Personal/parcel-flow/src/features/users/components/create-user-form.tsx)
- Affected merchant flow: [`src/features/merchant/server/actions.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/merchant/server/actions.ts), [`src/features/merchant/server/dal.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/merchant/server/dal.ts)
- Affected rider flow: [`src/features/rider/server/actions.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/rider/server/actions.ts), [`src/features/rider/server/dal.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/rider/server/dal.ts)
- Affected auth/session joins that resolve linked merchant context: [`src/features/auth/server/dal.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/auth/server/dal.ts)
- Affected UI routes and navigation that currently expose separate merchant/rider create entry points
