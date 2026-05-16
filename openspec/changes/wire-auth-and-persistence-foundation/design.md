## Context

Parcel Flow is a Next.js App Router monolith with feature-sliced UI and server folders. The current dashboard screens are mostly in place, but data is sourced from in-memory arrays and server actions validate input without persisting changes. The docs define Supabase PostgreSQL, Drizzle, and Better Auth as the target stack, with Better Auth's user model as the canonical user record and no separate `app_users` domain table.

This change covers Phase 1 and Phase 2 of the real backend wiring, plus rider assignment because the parcel list already contains selection and assignment UI. Parcel status progression, delivery side effects, financial item generation, merchant settlement workflows, and rider payout workflows stay out of scope until later phases.

## Goals / Non-Goals

**Goals:**

- Use Better Auth's user model as the single user record for authentication and Parcel Flow user metadata.
- Support admin-created users with username and password login.
- Generate Better Auth-compatible username and internal email values from the user's entered name.
- Protect dashboard routes and server actions with real sessions and server-side role checks.
- Replace Phase 1 and Phase 2 mock DAL/action behavior with Drizzle-backed persistence.
- Persist user management, bank accounts, township settings, parcel creation/listing, merchant/rider profile reads, and rider assignment.
- Keep existing feature-sliced boundaries and server-only database access.

**Non-Goals:**

- Public signup, OTP login, phone verification, public forgot-password, or self-service account creation.
- Parcel status transitions beyond rider assignment.
- Financial item generation, office collection confirmation, merchant settlement creation/payment, or rider payout creation/payment.
- Cloudflare R2 image upload implementation.
- New backend services, RPC layers, or client-side direct database access.

## Decisions

### Use Better Auth's user model as the canonical user record

Better Auth should own the auth user table and include the required Better Auth identity fields plus Parcel Flow-specific metadata. The MVP user record should include `name`, generated `username`, generated internal `email`, `phoneNumber`, `address`, `age`, `role`, `isActive`, and `mustResetPassword`. Domain tables reference Better Auth user IDs directly. This matches the updated project docs and avoids duplicated user identity across an auth table and a separate app user table.

Alternative considered: keep a separate profile-style `app_users` table linked to Better Auth users. That would reduce coupling to Better Auth schema shape but would create two user records for every person, complicating permissions, joins, and profile edits.

### Use username and admin plugins for MVP auth

The MVP login flow uses username and password. Better Auth should be configured with the username plugin and admin plugin. Admin-created users should be created through Better Auth admin-compatible APIs with a generated username and a generated internal email derived from the entered name. Email is required by Better Auth admin user creation, but it is not a user-facing login or account input in Parcel Flow MVP.

Usernames and internal emails should be generated from a normalized slug of the user's name and made unique with a deterministic suffix when needed. For example, `Daw Hnin` can produce username `daw-hnin`; a collision can produce `daw-hnin-2`. The internal email can be derived from the final username, such as `daw-hnin@users.parcel-flow.local`.

Alternative considered: use the phone number plugin for login. That is unnecessary for MVP because there is no phone verification and the app already has admin-created credentials. Username login avoids phone verification concerns while still allowing phone number to be stored as a contact/profile field.

### Treat Better Auth admin plugin as auth administration, not app authorization

The admin plugin should help with Better Auth user administration operations such as role assignment, password setting, disabling/banning users if adopted, and session/user management where it fits. It must not replace Parcel Flow authorization. Parcel Flow permissions for parcels, bank accounts, townships, merchant/rider scoping, assignment, settlements, and payouts remain enforced through server-side app permission checks.

Alternative considered: model all Parcel Flow permissions through the Better Auth admin plugin. That is too broad because the plugin's built-in permission resources focus on auth users and sessions, while Parcel Flow needs domain-specific ownership and workflow rules.

### Redirect users to role-appropriate pages after login

The current dashboard pages and UI are built from the superadmin point of view. Super admins can land on `/dashboard`. Office admins can use the operational admin dashboard with restricted actions. Merchant and rider users must not be redirected into the superadmin-oriented admin UI. They should land on minimal role-specific pages backed by scoped DAL queries.

Initial role landing routes:

| Role | Landing route |
|---|---|
| `super_admin` | `/dashboard` |
| `office_admin` | `/dashboard/parcels` |
| `merchant` | `/dashboard/merchant/parcels` |
| `rider` | `/dashboard/rider/parcels` |

Alternative considered: send every role to `/dashboard` and hide actions. That risks exposing a confusing superadmin-oriented interface and makes accidental data leakage more likely if a page-level guard is missed.

### Normalize user contact fields before persistence

The system should normalize generated usernames, generated internal emails, and user contact phone numbers before persistence. Username and email normalization protect login uniqueness. Phone number normalization keeps contact data consistent, even though phone number is not the login identity.

Alternative considered: store all values exactly as typed. That is simpler initially but brittle for username uniqueness, internal email uniqueness, and phone/contact consistency.

### Keep Drizzle DAL as the persistence boundary

Feature-specific `server/dal.ts` files should contain database reads/writes and DTO mapping should remain in `server/dto.ts` or nearby feature server helpers. Server actions validate inputs, enforce permissions, call DAL functions, and trigger route revalidation where needed.

Alternative considered: query directly from pages or client components. That would violate the repository architecture and make role/ownership rules harder to audit.

### Standardize form state by form complexity

All forms should be controlled from the first render. Simple forms with mostly text fields, textareas, password fields, and direct submit behavior should use server action forms with `useActionState` so submitted values and validation messages can be preserved after errors. The login form is the primary Phase 1 example.

Complex forms with selects, comboboxes, checkboxes, conditional sections, repeatable values, sheets, dialogs, or assignment summaries should use React Hook Form for client-side field state and submit to server actions for validation, permissions, and persistence. This applies to user create/edit, bank account dialogs, parcel create/edit, township pricing, and rider assignment.

Alternative considered: keep manually managed `useState` for all forms. That is workable for small forms but becomes fragile for larger forms and increases the chance of uncontrolled-to-controlled React warnings.

### Persist rider assignment before broader status workflows

Rider assignment is included with Phase 1/2 because the frontend already has selection, summary, and assignment affordances. Bulk assignment must only select unassigned parcels in statuses that require a rider: `at_office` for delivery, `postpone` for retry or scheduled delivery, and `canceled_returned` for return handling. Assignment must only set `rider_id` and `assigned_at`; it must not change parcel status to `on_the_way` or create financial items. Already assigned parcels should be disabled in the bulk assignment UI. Reassignment is handled from the edit parcel flow for now, with future bulk reassignment left out of scope.

Alternative considered: defer assignment to Phase 3 with status transitions. That would leave a visible UI flow non-functional after persistence wiring, despite the assignment rule being simpler than delivery status side effects.

### Use transactions for multi-table mutations

Admin user creation, profile creation, primary bank account changes, parcel creation, and bulk rider assignment should use transactions when more than one row/table is affected. This prevents partial state such as a user without a merchant profile or a parcel batch with only some assignments updated. If Better Auth admin APIs cannot be composed inside the same Drizzle transaction, the implementation should keep the sequence narrow, detect failures immediately, and document any compensation or cleanup step.

Alternative considered: sequential writes without transactions. That is easier to write but not acceptable for operational data consistency.

## Risks / Trade-offs

- Better Auth schema customization may require exact adapter-compatible field names and migrations -> verify against Better Auth generated schema before finalizing Drizzle schema.
- Generated usernames or internal emails may collide for similar names -> check uniqueness and append a deterministic suffix before creating the Better Auth user.
- Internal emails are implementation details -> never expose them as a login field or user-facing account field in MVP.
- Current dashboard UI is superadmin-oriented -> redirect merchant/rider users to minimal role-specific pages and enforce route-level guards.
- Local development currently bypasses auth in development -> replace with an explicit demo flag so real auth can be tested locally.
- Existing UI success messages describe mock behavior -> update only affected text and refresh behavior as mutations become persistent.
- Introducing React Hook Form adds a dependency and pattern to the project -> limit it to complex forms and keep simple forms on `useActionState`.
- Phase 2 parcel assignment without status transitions means riders can see assigned parcels in `at_office`, `postpone`, or `canceled_returned` status but cannot progress delivery/return statuses yet -> document this as expected until Phase 3.
- Settlement and payout pages may still show empty persisted data or basic list data -> avoid implementing financial business rules in this change.

## Migration Plan

1. Align Drizzle schema with Better Auth's required tables and the Parcel Flow domain diagram, removing the domain-owned `app_users` table.
2. Generate and apply migrations against a local or development Supabase PostgreSQL database.
3. Seed or manually create an initial super admin account using the Better Auth user model with generated username/internal email and `mustResetPassword` as needed.
4. Replace demo session fallback with explicit demo mode and verify real login locally.
5. Wire feature DAL/actions incrementally: auth/session, users/profiles/bank accounts, townships, parcels, rider assignment.
6. Run lint, typecheck, and database-backed smoke checks for login, create user, create township, create parcel, and assign rider.

Rollback for production should keep this behind migration review until ready. Before real production data exists, rollback can drop/recreate development tables. After production data exists, rollback must use forward migrations that preserve Better Auth users and domain records.

## Open Questions

- What exact canonical phone format should be used for contact phone numbers: local `09...` or international `+959...`?
- Should office admins be allowed to edit merchant/rider profile fields after user creation, or only super admins?
- Should a newly created user always start with `mustResetPassword = true`, including the initial generated password flow?
- Should this change include a minimal seed script for the first super admin, or should first admin creation be handled manually through a one-off command?
