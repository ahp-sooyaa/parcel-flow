# authorization-foundation Specification

## Purpose
TBD - created by archiving change auth-authorization-foundation. Update Purpose after archive.
## Requirements
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

### Requirement: Merchant settlement operations require explicit permissions
The system SHALL define explicit merchant settlement permissions and SHALL enforce them in route access, UI gating, and server actions. Settlement permissions MUST cover viewing settlement history, generating settlements, confirming payment, and cancelling or rejecting pending settlements.

#### Scenario: Authorized user views settlement history
- **WHEN** a user has merchant settlement view permission and requests merchant settlement history
- **THEN** the system allows the read and returns only authorized settlement DTO data

#### Scenario: Unauthorized user cannot generate settlement
- **WHEN** a user without merchant settlement create permission submits settlement generation data
- **THEN** the server action rejects the request and no settlement or settlement item records are created

#### Scenario: Unauthorized user cannot confirm payment
- **WHEN** a user without merchant settlement confirm permission submits payment confirmation data
- **THEN** the server action rejects the request and the settlement remains unpaid

#### Scenario: Unauthorized user cannot cancel or reject settlement
- **WHEN** a user without merchant settlement cancel permission submits a cancellation or rejection request
- **THEN** the server action rejects the request and preserves the settlement and payment record states

### Requirement: Settlement permissions fit existing first-iteration role model
The system SHALL add settlement permissions without introducing a new application role. Super admins SHALL receive all settlement permissions through the permission matrix, and any finance-like access for office users SHALL be represented by assigned permissions under the existing role model.

#### Scenario: Super admin receives settlement permissions
- **WHEN** auth foundation seed data is initialized
- **THEN** the super admin role includes merchant settlement view, create, confirm, and cancel permissions

#### Scenario: Finance access does not require new role
- **WHEN** an internal user is granted finance-like settlement authority in this iteration
- **THEN** the system represents that authority with merchant settlement permissions rather than a new role slug

#### Scenario: Merchant and rider roles lack settlement permissions
- **WHEN** auth foundation seed data is initialized
- **THEN** merchant and rider roles do not receive merchant settlement permissions

