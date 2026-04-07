## ADDED Requirements

### Requirement: Admin-only user creation
The system SHALL allow user creation only by authorized admins and SHALL reject creation attempts from unauthorized roles.

#### Scenario: Super admin creates a user
- **WHEN** a `super_admin` submits valid user creation input
- **THEN** the system creates the identity and corresponding app user record

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
The system SHALL allow admins to create users as inactive and persist that status at creation time.

#### Scenario: Admin selects inactive during creation
- **WHEN** an authorized admin submits user creation with inactive status
- **THEN** the created user is stored as inactive and blocked from protected access until activated

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
