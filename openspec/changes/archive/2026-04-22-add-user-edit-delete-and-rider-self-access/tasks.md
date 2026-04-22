## 1. Authorization And Context Groundwork

- [x] 1.1 Extend current-user context, auth DTOs, and related DAL helpers so the dashboard can resolve owned rider identifiers alongside owned merchant identifiers
- [x] 1.2 Update permission constants, seed expectations, and server-side guard helpers so office admins can execute update workflows while soft-delete authority remains super-admin-only
- [x] 1.3 Add shared soft-delete guard logic for protected cases such as self-delete and last-active-super-admin delete

## 2. Schema And Query Filtering

- [x] 2.1 Add `deleted_at` columns for the affected user, merchant, and rider tables in [`src/db/schema.ts`](/Users/aunghtet/Personal/parcel-flow/src/db/schema.ts)
- [x] 2.2 Generate the Drizzle migration for the `deleted_at` schema change without hand-writing migration SQL
- [x] 2.3 Update DAL queries, DTO loaders, and current-user resolution to exclude soft-deleted rows from normal operational reads by default

## 3. User Account Management Flows

- [x] 3.1 Add user-management DAL, DTO, and zod helper support for loading and validating editable shared `app_users` fields
- [x] 3.2 Implement admin user edit server actions with explicit field allowlists, audit logging, and route revalidation
- [x] 3.3 Implement the guarded super-admin soft-delete server action so eligible users are marked with `deleted_at`, lose dashboard access immediately, and disappear from normal UI
- [x] 3.4 Add user-management UI entry points from the users list and user detail area for edit and delete workflows, including confirmation feedback for soft-delete actions

## 4. Self Profile Experience

- [x] 4.1 Extend the profile feature DTOs, validation, and UI so `/dashboard/profile` remains the shared self-profile edit surface for all roles
- [x] 4.2 Add role-aware profile-page navigation so merchant users can reach their merchant maintenance flow and rider users can reach their rider maintenance flow from `/dashboard/profile`

## 5. Merchant Edit Workflow

- [x] 5.1 Add merchant DAL and validation support for loading and updating merchant-only profile fields from a dedicated edit workflow
- [x] 5.2 Add `/dashboard/merchants/[id]/edit` with server-enforced access checks for admins and owned-merchant self-service access
- [x] 5.3 Update merchant detail and related admin-managed surfaces to expose merchant edit entry points only when the current user is authorized

## 6. Rider Edit Workflow And Navigation

- [x] 6.1 Add rider DAL and validation support for loading and updating rider-only profile fields from a dedicated edit workflow
- [x] 6.2 Add `/dashboard/riders/[id]/edit` with server-enforced access checks for admins and owned-rider self-service access
- [x] 6.3 Update rider detail and related admin-managed surfaces to expose rider edit entry points only when the current user is authorized
- [x] 6.4 Update dashboard shell navigation so rider users receive a self link to their own rider detail page, matching the existing merchant self-navigation pattern

## 7. Verification

- [x] 7.1 Verify admin edit flows for shared user fields and linked merchant or rider profile entry points from user-management pages
- [x] 7.2 Verify merchant and rider self-service users can update only their own allowed records from profile-linked routes and cannot edit another user’s role profile
- [x] 7.3 Verify soft-delete behavior for self-delete protection, last-active-super-admin protection, and hidden-from-UI deleted records
- [x] 7.4 Add or update automated tests for authorization guards, soft-delete filtering, DTO navigation shaping, and the new server-action validation paths
