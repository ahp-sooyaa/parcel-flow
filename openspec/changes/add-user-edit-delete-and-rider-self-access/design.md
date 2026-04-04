## Context

The current dashboard supports user creation, user detail viewing, merchant detail viewing, rider detail viewing, and self-profile editing for shared identity data. It does not yet support administrative correction of shared user fields, administrative correction of linked merchant or rider profile data, or administrative soft deletion of accounts. It also does not surface rider self-navigation the way merchant self-navigation is already exposed in the dashboard shell.

The data model is already aligned around `app_users` as the shared identity table and `merchants` / `riders` as 1:1 profile tables keyed by `app_users.id`. That separation is a good fit for this change, but it means the implementation needs to coordinate shared-field edits and role-profile edits without collapsing business logic into a single oversized form or bypassing authorization checks. The change also touches security-sensitive paths because soft deletion affects authentication state, authorization scope, audit logging, query filtering, and profile ownership rules.

## Goals / Non-Goals

**Goals:**
- Add a consistent edit workflow for shared user profile fields from admin-managed surfaces and from `/dashboard/profile`.
- Add merchant and rider profile edit workflows that preserve feature-sliced ownership of business logic and enforce server-side self-scope for merchant and rider users.
- Add a guarded soft-delete workflow for app users that immediately removes dashboard access while preserving deleted records through `deleted_at`.
- Expose rider self-navigation in the dashboard shell using the same pattern already used for merchant self-navigation.
- Keep permissions and page access fail-closed, with explicit checks on the server for every read, edit, and soft-delete path.

**Non-Goals:**
- Introducing destructive hard-delete behavior for operational records
- Reworking parcel authorization, payout authorization, or broader permission architecture beyond the minimum permission matrix updates required here
- Adding public account recovery, public signup, or self-service role changes
- Introducing repository/service abstractions or new backend services outside the existing Next.js monolith
- Expanding editable identity fields beyond the currently supported shared fields unless needed to support existing forms

## Decisions

### Decision: Keep shared user edits and role-profile edits in separate server-action flows

Shared identity data such as `fullName` and `phoneNumber` belongs to `app_users`, while merchant and rider operational data belongs to their respective feature slices. The implementation will keep separate zod schemas, DAL functions, DTOs, and server actions for these domains, then compose them at the page level rather than creating one generic “edit everything” mutation.

This keeps business logic out of React components, preserves the existing feature-sliced structure, and limits the risk of overposting or role confusion. The alternative of a single admin mutation for all fields was rejected because it would blend `users`, `merchant`, and `rider` concerns into one action and make authorization harder to audit.

### Decision: Treat the users list page as an entry point, not the mutation surface

The users list page will expose `Edit` and `Delete` actions, but edits and destructive confirmation will execute through dedicated routes or focused action forms rather than inline table mutations. This keeps validation feedback clearer, avoids overly dense table UI, and matches the existing detail-page pattern already used in the dashboard.

The alternative of inline row editing in the table was rejected because it would increase client-state complexity, blur admin-only and self-service behaviors, and make role-specific field rendering harder to maintain.

### Decision: Use server-enforced scope rules for merchant and rider self-service edit routes

Merchant and rider users will edit their own role-specific data only from `/dashboard/merchants/[id]/edit` and `/dashboard/riders/[id]/edit`, with access gated by the same ownership-aware logic as the existing detail pages. Super admins and office admins will access those same routes through permission-based checks.

This preserves one route contract per role profile and avoids duplicating nearly identical self-service pages under `/dashboard/profile`. The alternative of embedding merchant and rider business forms directly inside `/dashboard/profile` was rejected because it would mix shared identity concerns with role-specific data entry and make the profile page much harder to reason about.

### Decision: Define delete as coordinated soft deletion with `deleted_at`, with strict guardrails

Delete will be specified as a super-admin-only server workflow that immediately removes the target user’s ability to access the dashboard by setting `deleted_at` on the target `app_users` row and the linked 1:1 merchant or rider profile row when present. Normal read paths and list queries will exclude rows whose `deleted_at` is set, so the deleted record bundle disappears from operational UI while remaining recoverable for audit purposes. The workflow will enforce guardrails such as blocking self-delete and blocking deletion of the last active super admin.

The implementation may satisfy the “access removed immediately” rule by disabling the account in auth and/or by treating `deleted_at` as a hard authorization stop on the server, but the contract will focus on the observable security outcome instead of coupling the spec to one vendor call. The alternative of hard-deleting rows was rejected because the business wants to prevent data loss. The alternative of using only `isActive` was rejected because deleted records should be hidden from normal operational UI while still being distinguishable from temporarily inactive accounts.

### Decision: Extend dashboard navigation DTOs with rider self-links

`toDashboardShellUserDto()` currently special-cases merchant self-navigation and falls back to permission-based list navigation for other roles. This change will extend the DTO contract so rider users receive a self link to their own rider detail page, while admins continue to see the rider list based on permissions.

This keeps navigation logic centralized on the server and prevents the client shell from inferring access based on role strings alone. The alternative of hardcoding rider menu behavior in the client shell was rejected because it would drift from the current server-authorized navigation model.

### Decision: Keep soft-delete authority exclusive to super admins

Office admins need update capabilities to satisfy the requested admin workflows, but soft-delete authority should remain exclusive to super admins. The permission matrix and guard logic will preserve this boundary explicitly instead of inferring it from UI visibility.

The alternative of granting office admins destructive authority was rejected because the requested clarification explicitly reserves all delete actions for super admins.

## Risks / Trade-offs

- [Soft delete spans app data, auth state, and query filtering] → Add `deleted_at` consistently to the affected tables, centralize active-row filtering in DAL helpers, and pair the mutation with audit logging plus access revocation checks.
- [Role-aware forms can drift apart] → Keep field schemas and server actions in their feature slices, and use dedicated route components that compose existing DTOs instead of reimplementing field mapping in multiple places.
- [Soft-deleted rows could leak back into UI] → Ensure list, detail, and navigation lookups exclude soft-deleted records by default and treat soft-deleted current users as unauthorized on the server.
- [Route sprawl across users, profile, merchants, and riders] → Reuse existing detail routes as entry points and keep new edit pages narrowly scoped, rather than creating parallel alternate dashboards.
- [Rider self-navigation could expose broken links without linked context] → Build rider navigation from resolved current-user context, mirroring the merchant pattern, and omit the self-link when the server cannot resolve the owned rider profile.

## Migration Plan

1. Add `deleted_at` columns in the schema and generate the Drizzle migration for soft deletion on the affected tables.
2. Add or extend DAL helpers and DTOs so current-user context, admin detail views, edit forms, and list queries resolve only non-deleted shared and role-specific records by default.
3. Add zod-validated server actions for user-profile update, merchant-profile update, rider-profile update, and guarded soft-delete flows with audit logging and route revalidation.
4. Add edit entry points in the users list and dedicated edit routes for merchant and rider detail pages.
5. Extend `/dashboard/profile` so shared self-profile editing remains the canonical place for self identity updates, with role-aware links into merchant or rider detail editing where needed.
6. Update dashboard navigation DTO generation to expose rider self-links and verify merchant behavior remains unchanged.
7. Update seeded permissions and authorization tests, then run regression checks for admin, merchant, and rider scopes.

Rollback requires reverting the application code and the soft-delete schema change together. If the feature must be rolled back after migration, restore from backup or ship a follow-up migration rather than manually rewriting deleted markers in production.

## Open Questions

- Whether soft-deleted accounts should also have their Supabase auth users disabled immediately, or whether server-side `deleted_at` enforcement alone is sufficient for the first implementation pass. Answer: let do server-side `deleted_at` enforcement alone for now.
