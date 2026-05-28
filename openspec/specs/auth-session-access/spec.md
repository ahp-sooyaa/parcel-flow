# auth-session-access Specification

## Purpose

TBD - created by archiving change wire-auth-and-persistence-foundation. Update Purpose after archive.

## Requirements

### Requirement: Canonical Better Auth user model

The system SHALL use the Better Auth user model as the canonical user record for Parcel Flow authentication and user metadata, and MUST NOT create or depend on a separate `app_users` domain table.

#### Scenario: Domain records reference authenticated users

- **WHEN** a domain record stores a user reference such as `created_by`, `paid_by`, `user_id`, or `collection_confirmed_by`
- **THEN** the stored ID references the Better Auth user model

#### Scenario: User metadata is available from session

- **WHEN** server code loads the current authenticated session
- **THEN** it can access the user's ID, name, username, internal email, phone number, address, age, role, active status, and password reset requirement from Better Auth-backed data

### Requirement: Admin-created username-password accounts

The system SHALL allow only authorized admins to create user accounts with username and password credentials.

#### Scenario: Admin creates user account

- **WHEN** an authorized admin submits valid user details and a generated password
- **THEN** the system creates a Better Auth user with username-password credentials, generated internal email, contact/profile fields, and the requested Parcel Flow role

#### Scenario: Username and internal email generation

- **WHEN** an admin creates a user account
- **THEN** the system generates a unique username and Better Auth-compatible internal email from the user's name

#### Scenario: Internal email hidden from user

- **WHEN** a Better Auth user is created with an internal email
- **THEN** the email is not shown as a login field or required account field in the MVP UI

#### Scenario: Public signup unavailable

- **WHEN** an unauthenticated visitor attempts to create an account through public application routes
- **THEN** the system does not expose a public signup flow

### Requirement: Better Auth admin plugin authorization boundary

The system SHALL use Better Auth admin plugin roles and permissions for coarse authorization, and SHALL additionally enforce Parcel Flow ownership and workflow rules in server-side domain logic.

#### Scenario: Auth admin operation

- **WHEN** the system creates users, sets roles, sets passwords, or disables auth users through Better Auth admin capabilities
- **THEN** the system first verifies the acting user's Better Auth role/permission and applies any Parcel Flow-specific restrictions such as office admins not managing super admins

#### Scenario: Domain authorization

- **WHEN** a user attempts a domain operation such as parcel assignment, township editing, bank account editing, or scoped parcel viewing
- **THEN** the system first verifies the required Better Auth role/permission and then enforces the relevant Parcel Flow rule, such as parcel status eligibility, selected rider validity, super-admin-only bank account editing, merchant ownership, or rider assignment scope

### Requirement: No phone verification or email login in MVP

The system SHALL NOT require phone verification and SHALL NOT expose email as a login method in MVP.

#### Scenario: Phone number is contact data

- **WHEN** an admin-created user account is persisted
- **THEN** the user's phone number is stored as contact/profile data, not as the login credential

#### Scenario: Username login

- **WHEN** a user signs in with username and password
- **THEN** the system authenticates with username/password credentials and does not require an OTP code or email login

### Requirement: Protected dashboard access

The system SHALL require an authenticated active user for dashboard routes and protected server actions.

#### Scenario: Unauthenticated dashboard request

- **WHEN** a request without a valid session targets a dashboard route
- **THEN** the system redirects or denies access before rendering protected dashboard content

#### Scenario: Inactive user session

- **WHEN** a user with `isActive = false` attempts to access protected dashboard content
- **THEN** the system denies access even if the session cookie is present

### Requirement: Role-based landing redirects

The system SHALL redirect authenticated users to a landing route appropriate for their Parcel Flow role.

#### Scenario: Super admin login

- **WHEN** a super admin signs in successfully
- **THEN** the system redirects to `/dashboard`

#### Scenario: Office admin login

- **WHEN** an office admin signs in successfully
- **THEN** the system redirects to `/dashboard/parcels`

#### Scenario: Merchant login

- **WHEN** a merchant signs in successfully
- **THEN** the system redirects to `/dashboard/merchant/parcels`

#### Scenario: Rider login

- **WHEN** a rider signs in successfully
- **THEN** the system redirects to `/dashboard/rider/parcels`

### Requirement: Role-based server authorization

The system SHALL enforce role permissions on the server for protected reads and mutations.

#### Scenario: Merchant requests unrelated data

- **WHEN** a merchant requests parcels, bank accounts, or profile data owned by another merchant
- **THEN** the system excludes or denies that data server-side

#### Scenario: Rider requests unrelated parcels

- **WHEN** a rider requests parcel data not assigned to that rider
- **THEN** the system excludes or denies that parcel server-side

#### Scenario: Admin-only mutation

- **WHEN** a non-admin user attempts a user, township, parcel creation, or rider assignment mutation
- **THEN** the system rejects the mutation before writing data

### Requirement: Role-based dashboard navigation

The system SHALL display only dashboard sidebar navigation items that the authenticated user's role can access.

#### Scenario: Office admin navigation

- **WHEN** an office admin views the dashboard sidebar
- **THEN** the system hides merchant-only and rider-only navigation items

#### Scenario: Merchant navigation

- **WHEN** a merchant views the dashboard sidebar
- **THEN** the system displays only merchant parcel access and settings navigation

#### Scenario: Rider navigation

- **WHEN** a rider views the dashboard sidebar
- **THEN** the system displays only rider parcel access and settings navigation

### Requirement: Password reset requirement

The system SHALL track whether a user must reset their password after admin account creation or regeneration.

#### Scenario: User must reset password

- **WHEN** a user with `mustResetPassword = true` signs in
- **THEN** the system identifies the reset requirement from authenticated user data so the UI can require a password change

#### Scenario: Admin regenerates password

- **WHEN** an authorized admin regenerates a user's password
- **THEN** the system updates the credentials and sets `mustResetPassword = true`

### Requirement: Stable login credential form state

The system SHALL keep the login username and password inputs under explicit form-state ownership throughout validation and submission re-renders so the sign-in experience remains stable when authentication fails.

#### Scenario: Username is preserved after failed login

- **WHEN** a user submits the login form with an invalid password or another recoverable authentication error
- **THEN** the login form re-renders with the previously entered username still visible and the validation or authentication message displayed

#### Scenario: Pending submission keeps controlled credentials UI

- **WHEN** a user submits the login form
- **THEN** the form shows its pending state without switching the credential fields between uncontrolled and controlled ownership

### Requirement: Authenticated account avatar menu

The system SHALL present authenticated dashboard account controls through an avatar-triggered menu that displays the signed-in user's identity and logout action.

#### Scenario: Dashboard header shows generated avatar access point

- **WHEN** an authenticated user views any dashboard page
- **THEN** the header displays a deterministic generated avatar for that user as the account-menu trigger instead of relying only on static text identity

#### Scenario: Avatar menu exposes logout

- **WHEN** the authenticated user opens the avatar menu
- **THEN** the menu shows the user's name, role, and a logout action that signs the user out of the current session
