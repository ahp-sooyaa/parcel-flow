## ADDED Requirements

### Requirement: Role model for first iteration
The system SHALL define exactly four application roles in the first iteration: `super_admin`, `office_admin`, `rider`, and `merchant`, and each user SHALL have exactly one role.

#### Scenario: User role assignment stored as one role
- **WHEN** a user record is created or updated
- **THEN** the system stores one and only one valid role assignment for that user

### Requirement: Permission-based authorization
The system SHALL authorize access using predefined permission records that are assignable by role via explicit mappings.

#### Scenario: Permission granted through role mapping
- **WHEN** a user role includes a mapped permission required by a route or action
- **THEN** the system allows the operation

#### Scenario: Permission missing
- **WHEN** a user attempts a protected operation without the required permission
- **THEN** the system denies the operation

### Requirement: Authorization enforcement in proxy, UI, and server actions
The system SHALL enforce authorization at all required layers: `proxy.ts`, UI-level permission gating using `IfPermitted`, and server action checks.

#### Scenario: Proxy blocks unauthorized route access
- **WHEN** a signed-in user requests a protected route without required access
- **THEN** `proxy.ts` redirects the user to `/unauthorized`

#### Scenario: UI hides unauthorized controls
- **WHEN** a signed-in user lacks a permission for an action button or section
- **THEN** `IfPermitted` does not render that UI control or section

#### Scenario: Server action denies bypass attempts
- **WHEN** a protected server action is invoked by a user without required permission
- **THEN** the server action rejects the request regardless of client UI state

### Requirement: Inactive account fail-closed behavior
The system SHALL treat inactive users as unauthorized for protected application access.

#### Scenario: Inactive user with valid session
- **WHEN** a user marked inactive has an otherwise valid authenticated session
- **THEN** route and action authorization checks deny protected access

### Requirement: Minimal first permission set
The system SHALL provide a minimal auditable permission set for initial rollout including at least user provisioning, dashboard access, and role-constrained actor access.

#### Scenario: Seeded baseline permissions exist
- **WHEN** the system is initialized for a new environment
- **THEN** baseline permissions are created and mapped to roles according to first-iteration policy

### Requirement: Password reset authorization control
The system SHALL require explicit permission for admin-assisted password reset operations using `user:reset_password`.

#### Scenario: Authorized admin performs password reset
- **WHEN** a user with `user:reset_password` permission invokes admin-assisted reset
- **THEN** the system allows the reset operation

#### Scenario: Unauthorized actor attempts password reset
- **WHEN** a user without `user:reset_password` permission invokes admin-assisted reset
- **THEN** the system denies the operation

### Requirement: Limited-access enforcement for reset-required users
The system SHALL allow users with `must_reset_password = true` to access dashboard shell with warning state and SHALL restrict normal or sensitive actions until password change is completed.

#### Scenario: Reset-required user enters dashboard
- **WHEN** a signed-in user with `must_reset_password = true` opens dashboard
- **THEN** the system shows a clear password-change-required warning and limits sensitive actions

#### Scenario: Reset-required user attempts restricted action
- **WHEN** a signed-in user with `must_reset_password = true` invokes a restricted operation
- **THEN** server authorization checks deny the operation until password is changed
