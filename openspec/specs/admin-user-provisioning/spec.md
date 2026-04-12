# admin-user-provisioning Specification

## Purpose
TBD - created by archiving change auth-authorization-foundation. Update Purpose after archive.
## Requirements
### Requirement: Admin-only user creation
The system SHALL allow user creation only by authorized admins and SHALL reject creation attempts from unauthorized roles. The admin user creation workflow SHALL support role-aware provisioning for `merchant` and `rider` accounts in the same server-side operation.

#### Scenario: Super admin creates an office admin user
- **WHEN** a `super_admin` submits valid office-admin user creation input
- **THEN** the system creates the Supabase identity and corresponding `app_users` record without creating merchant or rider profile rows

#### Scenario: Admin creates a merchant user with merchant profile fields
- **WHEN** an authorized admin submits valid user creation input with role `merchant`
- **THEN** the system creates the Supabase identity, the `app_users` record, and the required merchant profile record in one provisioning flow

#### Scenario: Admin creates a rider user with rider profile fields
- **WHEN** an authorized admin submits valid user creation input with role `rider`
- **THEN** the system creates the Supabase identity, the `app_users` record, and the required rider profile record in one provisioning flow

#### Scenario: Unauthorized role attempts user creation
- **WHEN** a role without user creation permission invokes user creation
- **THEN** the system rejects the request

### Requirement: Generated strong credentials for created users
The system SHALL generate a strong password server-side during admin user creation and SHALL not accept client-provided plaintext password for initial provisioning.

#### Scenario: Admin submits user creation form without password
- **WHEN** authorized admin creates a user
- **THEN** the system generates a strong password and uses it for provisioning

### Requirement: First-login reset flag on provisioned users
The system SHALL set `must_reset_password = true` for every newly admin-created user.

#### Scenario: Newly created user record
- **WHEN** a user is provisioned by admin flow
- **THEN** the resulting app user metadata sets `must_reset_password` to true

### Requirement: Support inactive user creation
The system SHALL allow admins to create users as inactive and persist that status at creation time. If the created role requires a merchant or rider profile, the system SHALL still create that profile row while keeping the account inactive.

#### Scenario: Admin selects inactive during merchant user creation
- **WHEN** an authorized admin submits merchant-role user creation with inactive status
- **THEN** the system stores the user as inactive and creates the required merchant profile row

#### Scenario: Admin selects inactive during rider user creation
- **WHEN** an authorized admin submits rider-role user creation with inactive status
- **THEN** the system stores the user as inactive and creates the required rider profile row

### Requirement: Admin-assisted password reset in user management
The system SHALL support admin-assisted password reset only from user-management flows under `/dashboard/users/*` and SHALL NOT add a standalone admin reset-password page in first iteration.

#### Scenario: Authorized admin resets password from user detail/edit flow
- **WHEN** an authorized admin triggers password reset on `/dashboard/users/[id]` or `/dashboard/users/[id]/edit`
- **THEN** the system performs reset from user-management context without requiring a separate admin reset page

### Requirement: Secure temporary password reset handling
The system SHALL generate a strong temporary password automatically during admin-assisted reset, update the Supabase Auth password, set `must_reset_password = true`, and SHALL NOT store the temporary password in application tables.

#### Scenario: Admin-assisted reset executes successfully
- **WHEN** an authorized admin submits a reset request for a target user
- **THEN** the system generates a strong temporary password, updates Supabase Auth credentials, and marks the user as reset-required

#### Scenario: Temporary password visibility is one-time only
- **WHEN** a reset operation returns the generated temporary password
- **THEN** the system displays it once to the authorized admin and does not persist the plaintext value in application storage

### Requirement: No email forgot-password flow in first iteration
The system SHALL NOT use email-based forgot-password flow in first iteration and SHALL route operational password recovery through admin-assisted reset.

#### Scenario: User requests forgot-password in first iteration
- **WHEN** a user cannot access account due to forgotten password
- **THEN** the documented operational flow requires authorized admin-assisted reset

### Requirement: Initial super admin bootstrap
The system SHALL provide an idempotent bootstrap process that seeds one super admin user for first system access.

#### Scenario: Bootstrap run on empty environment
- **WHEN** initialization runs in an environment without existing super admin mapping
- **THEN** the system creates or links one super admin identity and app user assignment

#### Scenario: Bootstrap rerun
- **WHEN** initialization runs again after baseline data exists
- **THEN** the bootstrap process does not create duplicate super admin records

### Requirement: Role-specific profile defaults are applied during provisioning
The system SHALL apply explicit server-side defaults when creating role-specific profile rows from the user create workflow and SHALL leave unspecified optional profile fields as `null` unless a documented default is required.

#### Scenario: Merchant shop name defaults from app user name
- **WHEN** an authorized admin creates a merchant-role user without providing `shop_name`
- **THEN** the system stores the merchant profile with `shop_name` equal to the created app user's full name

#### Scenario: Rider vehicle type defaults to bike
- **WHEN** an authorized admin creates a rider-role user without providing `vehicle_type`
- **THEN** the system stores the rider profile with `vehicle_type` set to `bike`

#### Scenario: Optional role-specific fields remain null when omitted
- **WHEN** an authorized admin omits optional merchant or rider profile fields other than documented defaults
- **THEN** the system stores those omitted fields as `null`

### Requirement: Provisioning fails closed when profile creation cannot complete
The system MUST avoid leaving a partially provisioned merchant-role or rider-role account when any required profile write fails after identity creation has started.

#### Scenario: Merchant profile write fails after auth user creation
- **WHEN** the system has created the Supabase auth user but merchant profile creation fails
- **THEN** the system aborts provisioning, removes any newly created auth identity or app-user record created by that request, and returns an error

#### Scenario: Rider profile write fails after app user insert
- **WHEN** the system has created the auth user and app-user row but rider profile creation fails
- **THEN** the system aborts provisioning, cleans up the partial account state created by that request, and returns an error

