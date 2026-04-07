# auth-foundation Specification

## Purpose
TBD - created by archiving change auth-authorization-foundation. Update Purpose after archive.
## Requirements
### Requirement: Supabase sign-in only access
The system SHALL authenticate users through Supabase sign-in only and SHALL NOT allow public signup from the application.

#### Scenario: Signup endpoint is unavailable to public users
- **WHEN** an unauthenticated visitor navigates to auth entry points
- **THEN** the system only presents sign-in flow and does not expose a self-service signup option

### Requirement: Email login with phone as contact field
The system SHALL require email for Supabase Auth login and SHALL support `phone_number` as an application contact field for user profile and operations usage.

#### Scenario: User creation includes email and optional phone contact
- **WHEN** an authorized admin creates a user
- **THEN** the system requires email for identity and stores phone number as contact data when provided

#### Scenario: Phone contact does not alter authentication method
- **WHEN** phone number exists on an app user profile
- **THEN** the system continues to authenticate with email credentials in the first iteration

### Requirement: No phone-based auth flows in first iteration
The system SHALL NOT implement OTP, SMS verification, phone-based login, or phone-based password reset in the first iteration.

#### Scenario: User attempts phone-first auth
- **WHEN** a user attempts to authenticate or reset password using phone-only flow
- **THEN** the system does not provide phone-based auth or reset mechanisms

### Requirement: Protected dashboard shell access
The system SHALL protect dashboard routes behind authenticated sessions and SHALL render the app shell with sidebar and logout for authorized users.

#### Scenario: Authenticated authorized user accesses dashboard
- **WHEN** a signed-in user with valid app authorization accesses a protected dashboard route
- **THEN** the system renders the protected app shell including sidebar navigation and logout control

#### Scenario: Unauthenticated user accesses dashboard
- **WHEN** an unauthenticated user requests a protected dashboard route
- **THEN** the system redirects the request to the sign-in page

### Requirement: Current-user auth context resolution
The system SHALL resolve the current user context from Supabase session identity to app user profile, role, status, and permissions before protected processing.

#### Scenario: Session maps to existing app user
- **WHEN** a request includes a valid Supabase session with a known identity
- **THEN** the system loads corresponding app user role and permission data for authorization decisions

#### Scenario: Session has no app user mapping
- **WHEN** a request includes a valid Supabase session without a matching app user record
- **THEN** the system denies protected access and treats the request as unauthorized

### Requirement: Self profile and security route
The system SHALL provide `/dashboard/profile` for authenticated users to view own account data, edit allowed self profile fields, and change own password.

#### Scenario: Authenticated user accesses own profile page
- **WHEN** a signed-in authorized user navigates to `/dashboard/profile`
- **THEN** the system shows own account information and allowed self-service profile/security actions

