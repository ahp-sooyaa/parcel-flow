## ADDED Requirements

### Requirement: Persisted user list
The system SHALL load the user management list from the database instead of mock arrays.

#### Scenario: Admin views users
- **WHEN** an authorized admin opens the users page
- **THEN** the system displays persisted users with name, username, role, phone number, address, age, active status, password reset status, merchant profile data, rider profile data, service township data, and bank account data as applicable

#### Scenario: Non-admin views users
- **WHEN** a merchant or rider attempts to access admin user management data
- **THEN** the system denies access or excludes the data server-side

### Requirement: Persisted user creation
The system SHALL persist admin-created users and their role-specific profiles in one consistent operation.

#### Scenario: Create office admin
- **WHEN** an authorized admin creates an office admin account
- **THEN** the system creates a Better Auth user with generated username, generated internal email, contact/profile fields, the office admin role, and no merchant or rider profile

#### Scenario: Create merchant user
- **WHEN** an authorized admin creates a merchant account with shop details
- **THEN** the system creates a Better Auth user with generated username, generated internal email, contact/profile fields, and a linked merchant profile in the database

#### Scenario: Create rider user
- **WHEN** an authorized admin creates a rider account with rider details and service townships
- **THEN** the system creates a Better Auth user with generated username, generated internal email, contact/profile fields, linked rider profile, and rider service township records in the database

#### Scenario: Generated username collision
- **WHEN** the username generated from a user's name already exists
- **THEN** the system appends a deterministic suffix before creating the Better Auth user and derives the internal email from the final unique username

### Requirement: Persisted user update
The system SHALL update Better Auth user metadata and role-specific profile records from the admin user edit flow.

#### Scenario: Admin updates basic user fields
- **WHEN** an authorized admin submits valid changes to name, phone number, address, age, active status, or role-supported fields
- **THEN** the system persists those changes to the Better Auth user model and linked profile tables

#### Scenario: Generated identity fields stay stable
- **WHEN** an authorized admin updates an existing user's name or contact fields
- **THEN** the system does not automatically change the generated username or internal email

#### Scenario: Office admin cannot manage super admin
- **WHEN** an office admin attempts to update or regenerate credentials for a super admin
- **THEN** the system rejects the operation server-side

### Requirement: Persisted bank account management
The system SHALL persist bank accounts linked to Better Auth users and enforce super-admin-only creation and editing.

#### Scenario: Super admin creates bank account
- **WHEN** a super admin adds a bank account for a user
- **THEN** the bank account is stored with the selected user ID and appears after page refresh

#### Scenario: Non-super-admin bank account edit blocked
- **WHEN** an office admin, merchant, or rider attempts to add, edit, or delete a bank account
- **THEN** the system rejects the mutation server-side

#### Scenario: User views own bank accounts
- **WHEN** a merchant or rider opens their settings
- **THEN** the system displays only that user's persisted bank accounts as read-only data

#### Scenario: Self bank account edit blocked
- **WHEN** a merchant or rider attempts to add, edit, or delete their own bank account
- **THEN** the system rejects the mutation server-side

### Requirement: Primary bank account consistency
The system SHALL maintain at most one primary non-deleted bank account per user.

#### Scenario: Mark account primary
- **WHEN** a super admin saves a bank account as primary for a user
- **THEN** the system clears primary status from that user's other active bank accounts in the same operation

### Requirement: Self account settings persistence
The system SHALL allow authenticated users to update permitted personal account fields and password.

#### Scenario: User updates own account details
- **WHEN** an authenticated user submits valid editable account details
- **THEN** the system persists allowed fields and does not allow role, permission, active status, or bank account changes

#### Scenario: User changes password
- **WHEN** an authenticated user submits their current password and a valid new password
- **THEN** the system updates their credentials and clears `mustResetPassword` when the change succeeds
