## 1. Schema and Migration Foundation

- [x] 1.1 Align `src/db/schema.ts` with Better Auth's required user/account/session tables and remove the domain-owned `app_users` table.
- [x] 1.2 Add Better Auth identity and Parcel Flow user metadata fields to the Better Auth user model: generated username, generated internal email, phone number, address, age, role, active status, and password reset requirement.
- [x] 1.3 Update domain foreign keys so merchants, riders, parcels, financial items, bank accounts, parcel status logs, settlements, and payouts reference Better Auth user IDs where user references are needed.
- [x] 1.4 Verify merchant, rider, rider service township, township, parcel, bank account, and assignment-related schema fields match the database diagram and project spec.
- [x] 1.5 Generate Drizzle migrations and verify they apply cleanly against a development PostgreSQL/Supabase database.

## 2. Auth, Session, and Route Protection

- [x] 2.1 Configure Better Auth with Drizzle, username/password login, admin plugin, username plugin, and MVP user metadata fields.
- [x] 2.2 Implement username generation from the submitted user name, including collision handling.
- [x] 2.3 Implement internal email generation from the final username for Better Auth admin-created users.
- [x] 2.4 Disable public signup and avoid exposing OTP, phone verification, email login, and public forgot-password flows in the app.
- [x] 2.5 Implement admin-created account creation through the Better Auth admin plugin with generated username/internal email and contact fields stored on the Better Auth user model.
- [x] 2.6 Remove development-only demo user fallback and require real Better Auth sessions.
- [x] 2.7 Update `getCurrentUser` and `requireCurrentUser` to load real Better Auth session data and reject inactive users.
- [x] 2.8 Enforce dashboard route protection in `src/proxy.ts` using Better Auth session state plus Parcel Flow role guards.
- [x] 2.9 Wire the login form as a controlled `useActionState` server-action form that preserves submitted username after validation errors and redirects authenticated users by role.
- [x] 2.10 Implement role landing redirects for super admin, office admin, merchant, and rider users.
- [x] 2.11 Implement password update and admin password regeneration with `mustResetPassword` handling.

## 3. Form State Standards

- [x] 3.1 Add React Hook Form if it is not already installed.
- [x] 3.2 Keep simple text/password/textarea forms as controlled server-action forms using `useActionState`.
- [x] 3.3 Use React Hook Form with server actions for complex controlled forms containing selects, comboboxes, checkboxes, conditional sections, dialogs, sheets, or summary behavior.
- [x] 3.4 Ensure all form controls receive explicit default values to avoid uncontrolled-to-controlled warnings.
- [x] 3.5 Keep Zod validation on the server for every persisted form submission.

## 4. User, Profile, and Bank Account Persistence

- [x] 4.1 Replace mock user DAL reads with Drizzle queries that map Better Auth users, merchant profiles, rider profiles, service townships, and bank accounts to existing DTOs.
- [x] 4.2 Implement create user action persistence for office admin, merchant, and rider accounts with generated username/internal email, Better Auth custom fields, and role-specific profile creation.
- [x] 4.3 Implement update user action persistence for Better Auth user metadata and linked merchant/rider profile fields.
- [x] 4.4 Implement rider service township persistence for rider creation and updates.
- [x] 4.5 Implement super-admin-only bank account create/update persistence with at-most-one-primary-account enforcement per user.
- [x] 4.6 Enforce server-side permissions for user/profile/bank account reads and mutations, including office admin restrictions around super admins and all non-super-admin bank account edits.
- [x] 4.7 Implement self account settings persistence for allowed profile fields and password changes while blocking role, active status, and bank account edits.
- [x] 4.8 Update affected user/settings UI success states to reflect persisted saves and refresh server-rendered data after successful mutations.

## 5. Township Settings Persistence

- [x] 5.1 Replace mock township DAL reads with Drizzle queries.
- [x] 5.2 Implement create township action persistence with validation and super-admin permission checks.
- [x] 5.3 Implement update township action persistence with validation and super-admin permission checks.
- [x] 5.4 Ensure parcel creation form selectors use active persisted townships.
- [x] 5.5 Verify existing parcel delivery fees remain stored values after township pricing changes.

## 6. Merchant and Rider Read Models

- [x] 6.1 Replace mock merchant list reads with Drizzle queries joining merchant profiles to Better Auth users.
- [x] 6.2 Replace mock rider list reads with Drizzle queries joining rider profiles, Better Auth users, service townships, and parcel collection aggregates.
- [x] 6.3 Calculate rider expected collection from active assigned parcels with statuses `at_office`, `on_the_way`, and `postpone`.
- [x] 6.4 Calculate rider actual collection from delivered assigned parcels using persisted collection fields available in Phase 2 scope.
- [x] 6.5 Enforce role-scoped merchant and rider read access server-side.

## 7. Parcel Intake Persistence

- [x] 7.1 Replace mock parcel list and summary DAL reads with Drizzle queries and DTO mapping.
- [x] 7.2 Implement role-scoped parcel visibility for admins, merchants, and riders.
- [x] 7.3 Preserve MVP admin parcel list controls against persisted data: search box, township combobox filter, parcel status filter, and assignment-state tabs for all/unassigned/assigned.
- [x] 7.4 Keep merchant filter, rider filter, date-range filter, and pagination out of Phase 1/2 unless a later UI change adds them.
- [x] 7.5 Implement persisted parcel creation with generated unique `PF-XXXXXX-XXXXXX` parcel codes and retry-on-collision behavior.
- [x] 7.6 Persist parcel creation defaults for status, COD status, delivery fee status, office receipt status, settlement status, payout status, created-by, timestamps, and optional dimensions/images fields.
- [x] 7.7 Validate referenced merchant and active township records during parcel creation.
- [x] 7.8 Recalculate parcel dashboard summaries from persisted records, including assigned `at_office` parcels in expected collection.
- [x] 7.9 Update create parcel UI success flow to reflect persisted creation and refresh the parcel list.
- [x] 7.10 Create a minimal `/dashboard/merchant/parcels` page backed by merchant-scoped parcel DAL queries.
- [x] 7.11 Create a minimal `/dashboard/rider/parcels` page backed by rider-scoped parcel DAL queries.
- [x] 7.12 Guard superadmin-oriented parcel management pages so merchant and rider users cannot see admin-only controls.

## 8. Rider Assignment Persistence

- [x] 8.1 Add server action and DAL logic for assigning selected parcels to a rider in one transaction.
- [x] 8.2 Validate assignment permissions, active rider existence, selected parcel existence, unassigned state, and eligible statuses `at_office`, `postpone`, or `canceled_returned` before writing.
- [x] 8.3 Disable bulk assignment selection for already assigned parcels and reject assigned parcel IDs server-side if submitted.
- [x] 8.4 Persist `rider_id` and `assigned_at` for selected parcels without changing parcel status or creating financial side effects.
- [x] 8.5 Wire `AssignRiderDialog` confirm behavior to the persisted assignment action.
- [x] 8.6 Refresh parcel and rider read models after assignment so assigned counts, rider names, and expected collection totals update.
- [x] 8.7 Ensure assigned parcels become visible to the assigned rider and remain hidden from other riders.
- [x] 8.8 Keep reassignment for already assigned parcels in the edit parcel flow and leave future bulk reassignment out of scope.

## 9. Verification and Cleanup

- [x] 9.1 Remove or isolate Phase 1/2 mock arrays so persisted flows are the default behavior.
- [x] 9.2 Update `.env.example` or setup notes for required Better Auth and database variables.
- [x] 9.3 Run migration generation/application checks against a development database.
- [x] 9.4 Run lint and typecheck.
- [x] 9.5 Perform database-backed smoke checks for login, create user, edit user, create bank account, create township, create parcel, and assign rider.
- [x] 9.6 Confirm settlement, payout, delivery status progression, financial item side effects, and R2 uploads remain out of scope for this change.
