# Parcel Flow — Technical Services and Tools

## 1. Overview

This document lists the main technical services, frameworks, libraries, and security tools used in the **Parcel Flow** project.

Parcel Flow is a Next.js-based internal delivery management system. The stack is selected for fast development, type safety, secure authentication, database reliability, clean UI development, deployment simplicity, and basic security quality control.

---

## 2. Technical Stack Summary

| Area | Tool / Service | Purpose |
|---|---|---|
| Hosting / Deployment | Railway | Deploy and host the web application |
| Database Infrastructure | Supabase | PostgreSQL database and database hosting infrastructure |
| Authentication | Better Auth | Username + password authentication and session management |
| Frontend Framework | Next.js | Full-stack React framework |
| UI Components | shadcn/ui | Reusable UI components |
| Form State | React Hook Form | Controlled complex forms with server actions |
| Styling | Tailwind CSS | Utility-first CSS styling |
| ORM / Database Access | Drizzle ORM | Type-safe database schema and queries |
| Validation | Zod | Runtime validation and form/schema validation |
| Object Storage | Cloudflare R2 | Store parcel images and uploaded files |
| Linting / Formatting | OXC | Fast linting and formatting |
| Code Quality | SonarQube | Code quality and maintainability checks |
| Dependency Security | Socket Security | Dependency and supply chain security scanning |

---

## 3. Railway

## Purpose

Railway is used to deploy and host the Parcel Flow application.

## Why We Use It

Railway gives a simple deployment flow for a Next.js project without needing to manually manage a VPS.

## Usage in Parcel Flow

Railway is used for:

- Hosting the production web app
- Running the Next.js application
- Managing production environment variables
- Preview deployments, if enabled
- Connecting the app to external services like Supabase and Cloudflare R2

## Important Notes

- Environment variables must be configured in Railway.
- Production secrets should not be committed to GitHub.
- Railway deployment should be connected to the main production branch.
- PR preview deployments can be useful but should not use production credentials unless required.

---

## 4. Supabase

## Purpose

Supabase is used as the PostgreSQL database provider and database infrastructure.

## Why We Use It

Supabase provides hosted PostgreSQL, database dashboard, and SQL tooling.

## Usage in Parcel Flow

Supabase is used for:

- PostgreSQL database
- Storing Parcel Flow domain tables
- Storing Better Auth tables in the same database as the domain tables
- Database migrations through Drizzle
- Optional Row Level Security if needed later

## Important Notes

- Public signup is disabled in the application flow.
- Users are created by admin only.
- The app uses username and password login through Better Auth.
- Database access from the app should go through controlled server-side logic.
- Sensitive queries should not be exposed directly from the client.

---

## 5. Better Auth

## Purpose

Better Auth is used for application authentication.

## Why We Use It

Better Auth gives flexible authentication logic and can support custom account creation flow.

## Usage in Parcel Flow

Better Auth is used for:

- Username + password login
- Session management
- Auth-related tables in the main database
- The Better Auth user model as the canonical user record for Parcel Flow
- Password changes
- Admin-created user accounts
- Password regeneration flow
- Role-based access integration

## Important Notes

- There is no public signup.
- There is no phone verification in MVP.
- Admin-created users receive credentials manually.
- The canonical user record is the Better Auth user model.
- The application must not create a separate `app_users` domain table.
- Better Auth should use the username plugin and admin plugin for MVP authentication/account administration.
- Better Auth admin-created users still require an email, so the system should generate an internal email from the generated username. Email is not a user-facing login field in MVP.
- Parcel Flow-specific user fields such as username, generated internal email, phone number, address, age, role, active status, and `must_reset_password` should be configured on the Better Auth user model.
- Phone number, address, and age are profile/contact fields only; they are not authentication factors in MVP.
- After password regeneration, `must_reset_password` should be set to true.
- Office admin can regenerate normal user passwords but not super admin passwords.

---

## 6. Next.js

## Purpose

Next.js is the main application framework.

## Why We Use It

Next.js supports full-stack React development with server components, server actions, routing, and API handling in one project.

## Usage in Parcel Flow

Next.js is used for:

- App Router
- Full-stack monolith application structure
- Dashboard pages
- Merchant overview and parcel listing pages
- Server-side data loading
- Server actions
- Authentication-protected routes
- Role and permission checks
- Admin, merchant, and rider dashboards

## Important Notes

- Sensitive actions should run on the server.
- Permission checks should happen in server actions and server-side data loaders.
- UI hiding alone is not enough for security.
- Route protection should be enforced for dashboard routes.
- Use `proxy.ts`, not `middleware.ts`.
- Do not introduce extra backend services or extra architectural layers unless explicitly requested.

---

## 7. shadcn/ui

## Purpose

shadcn/ui is used for reusable UI components.

## Why We Use It

It provides clean, customizable components built on Radix UI and Tailwind CSS.

## Usage in Parcel Flow

shadcn/ui is used for:

- Buttons
- Forms
- Dialogs
- Tables
- Sheets
- Tabs
- Dropdowns
- Selects
- Command / combobox UI
- Toasts or notifications

## Important UI Patterns

The project uses:

- Right-side sheets for create/edit flows
- Dialogs for small forms
- Tables for listing pages
- Tabs for account and bank account settings
- Combo boxes for selecting merchant, rider, and township
- Financial-item-based settlement creation and payout drafting

---

## 8. Tailwind CSS

## Purpose

Tailwind CSS is used for styling.

## Why We Use It

Tailwind allows fast UI building with utility classes and works well with shadcn/ui.

## Usage in Parcel Flow

Tailwind is used for:

- Layout
- Spacing
- Typography
- Responsive design
- Component styling
- Dashboard UI

## Important Notes

- Keep class names readable.
- Avoid over-customizing components unless needed.
- Reuse consistent spacing and layout patterns.
- Prefer clear UI structure over complex custom design.

---

## 8.1 React Hook Form

## Purpose

React Hook Form is used for complex client-side form state while preserving server actions as the persistence and authorization boundary.

## Why We Use It

Parcel Flow has forms with comboboxes, selects, checkboxes, conditional fields, sheets, dialogs, and summary panels. React Hook Form helps keep those controlled and predictable without moving business rules to the client.

## Usage in Parcel Flow

React Hook Form is used for complex forms such as:

- Create/edit user
- Bank account create/edit
- Create/edit parcel
- Assign rider
- Township pricing
- Merchant settlement creation
- Settlement receipt resolution
- Rider payout draft

Simple forms should use server action forms with `useActionState` instead. Examples include login, password change, and small text-only account detail forms.

## Important Notes

- All form fields should be controlled from the first render.
- Preserve submitted values after validation errors.
- Use server actions for final validation, permission checks, and persistence.
- Use Zod on the server for all important submitted inputs.
- Client-side validation is allowed for UX but must not be the only validation layer.

---

## 9. OXC

## Purpose

OXC is used for linting and formatting.

## Why We Use It

OXC is fast and helps keep the codebase consistent.

## Usage in Parcel Flow

OXC is used for:

- Lint checks
- Formatting checks
- CI validation
- Preventing common code quality issues

## Important Notes

- Run lint and format before opening pull requests.
- CI should fail when lint or format checks fail.
- Use one consistent formatting setup across the project.

---

## 10. Drizzle ORM

## Purpose

Drizzle is used for database schema, migrations, and type-safe database queries.

## Why We Use It

Drizzle keeps database access close to TypeScript and gives good control over SQL.

## Usage in Parcel Flow

Drizzle is used for:

- Defining database schema
- Running migrations
- Querying parcels, merchants, riders, users, settlements, and financial items
- Type-safe database operations

## Important Notes

- Schema changes should be done through migrations.
- Avoid manual database changes that are not reflected in Drizzle schema.
- Server-side queries should enforce role and ownership rules.
- Merchant queries must be scoped to the current merchant.
- Merchant overview metrics, settlement history, and parcel list filters should be resolved server-side from validated query params.
- Rider queries must be scoped to assigned rider parcels.
- `financial_items` supports both merchant settlement and rider payout workflows.
- `cod_remit` should be created only after office confirms rider cash handover for a delivered COD parcel.
- `is_received_by_office` is modeled as a boolean field.
- Rider delivery failure reports should use the parcel `delivery_failure_note` field, not `special_notes`.

---

## 11. Zod

## Purpose

Zod is used for validation.

## Why We Use It

Zod provides runtime validation and TypeScript-friendly schemas.

## Usage in Parcel Flow

Zod is used for:

- Form validation
- Server action input validation
- Query/filter validation
- Enum validation
- Safe parsing of user input

## Important Notes

Use Zod for important inputs such as:

- Parcel create/edit form
- User create/edit form
- Rider create/edit form
- Merchant create/edit form
- Merchant overview settlement-history search, date filter, and pagination params
- Merchant parcel search, date filter, status tab, and pagination params
- Merchant settlement creation from dashboard financial items
- Super admin settlement resolution with bank transfer receipt
- Rider payout creation
- Password change
- Password regeneration

---

## 12. Cloudflare R2

## Purpose

Cloudflare R2 is used for object storage.

## Why We Use It

R2 provides S3-compatible object storage and is useful for storing uploaded parcel images.

## Usage in Parcel Flow

Cloudflare R2 is used for:

- Proof of delivery images
- Pickup images
- Bank transfer receipt storage
- Future attachment storage

## Important Notes

- Store only object keys in the database.
- Do not store public raw URLs as permanent source of truth.
- Generate signed URLs when private access is required.
- Use structured paths for objects.

Recommended object key format:

```text
parcels/{parcel_id}/proof-of-delivery/{file_name}
parcels/{parcel_id}/pickup/{file_name}
```

---

## 13. SonarQube

## Purpose

SonarQube is used for code quality checks.

## Why We Use It

SonarQube helps detect maintainability, reliability, and security issues in code.

## Usage in Parcel Flow

SonarQube is used for:

- Pull request quality checks
- Code smell detection
- Bug detection
- Security hotspot detection
- Quality gate validation

## Important Notes

- SonarQube runs automatically when a pull request is pushed or updated.
- SonarQube does not need to run inside the application CI pipeline.
- Pull requests should pass the quality gate before merging.
- Common issues should be fixed early, not after features are complete.
- When writing code, follow SonarQube rules as much as possible.

---

## 14. Socket Security

## Purpose

Socket Security is used for dependency and supply chain security.

## Why We Use It

It helps detect risky, malicious, or suspicious packages before they enter the project.

## Usage in Parcel Flow

Socket Security is used for:

- Dependency security checks
- Pull request package review
- Supply chain risk detection
- Alerting on suspicious package behavior

## Important Notes

- Review Socket alerts before merging dependency changes.
- Dependabot updates should still pass Socket checks.
- Do not ignore high-risk dependency warnings without checking.
- Socket and SonarQube solve different problems:
  - Socket checks dependencies.
  - SonarQube checks code quality and code security issues.

---

## 15. Service Responsibilities

| Responsibility | Tool / Service |
|---|---|
| Web application framework | Next.js |
| Deployment | Railway |
| Database | Supabase PostgreSQL |
| Authentication | Better Auth |
| UI components | shadcn/ui |
| Form state | React Hook Form |
| Styling | Tailwind CSS |
| ORM and migrations | Drizzle |
| Input validation | Zod |
| Image/file storage | Cloudflare R2 |
| Linting and formatting | OXC |
| Code quality | SonarQube |
| Dependency security | Socket Security |

---

## 16. Development Workflow

Recommended development workflow:

1. Create or update feature branch.
2. Update Drizzle schema and migrations if database changes are needed.
3. Build UI with shadcn/ui and Tailwind CSS.
4. Use `useActionState` for simple controlled server-action forms.
5. Use React Hook Form with server actions for complex controlled forms.
6. Validate all form/server inputs with Zod.
7. Use server actions or server-side functions for protected operations.
8. Run OXC lint and format checks.
9. Run typecheck.
10. Open pull request.
11. Confirm CI, automatic SonarQube pull request checks, and Socket Security checks.
12. Deploy through Railway after merge.

---

## 17. Security Rules

Important security rules:

- Do not expose admin operations to client-only checks.
- Always check role and permission on the server.
- Merchants can only access their own parcels and settlements.
- Riders can only access assigned parcels.
- Bank account editing is admin-only.
- Password regeneration is admin-only.
- Office admin cannot regenerate super admin passwords.
- Delivery fee manual override is super admin-only.
- Settlement paid confirmation is super admin-only.
- Rider payout paid confirmation is super admin-only.
- Object storage keys should not expose sensitive data.
- Production secrets must only be stored in Railway or service dashboards.

---

## 18. Environment Variables

The project should define environment variables for:

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL

SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

CLOUDFLARE_R2_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET_NAME
CLOUDFLARE_R2_PUBLIC_URL_OR_CUSTOM_DOMAIN
```

Actual variable names may change based on implementation.

Rules:

- Never commit real secrets.
- Use `.env.local` for local development.
- Use Railway environment variables for production.
- Use separate credentials for development and production if possible.

---

## 19. Out of Scope

This document does not define:

- Database table design
- Detailed permission matrix
- API route design
- UI screen-by-screen design
- Business workflow spec
- Deployment runbook

Those should be documented separately.
