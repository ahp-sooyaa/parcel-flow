## ADDED Requirements

### Requirement: Bun test runner configuration
The system SHALL provide Bun-based unit and integration test scripts that can run TypeScript tests without requiring a separate JavaScript test runner.

#### Scenario: Fast test command
- **WHEN** a developer runs the standard fast test command
- **THEN** the system runs Bun unit tests without requiring database or browser dependencies

#### Scenario: Integration test command
- **WHEN** a developer runs the integration test command with test database environment variables configured
- **THEN** the system runs Bun integration tests that can exercise server actions and DAL persistence

#### Scenario: Combined regression command
- **WHEN** a developer runs the combined regression command
- **THEN** the system executes unit, integration, and E2E test layers in a documented order

### Requirement: DOM component testing support
The system SHALL support React component tests through happy-dom and React Testing Library.

#### Scenario: Component test renders client form
- **WHEN** a component test renders a client form that uses React state or form interactions
- **THEN** the test environment provides DOM APIs required to interact with inputs, buttons, dialogs, sheets, comboboxes, and validation messages

#### Scenario: Accessible interaction assertions
- **WHEN** a component test verifies user interactions
- **THEN** the test uses accessible queries or user-facing labels rather than implementation-only selectors where practical

### Requirement: Auth and route protection regression coverage
The system SHALL include automated tests for authenticated session loading, inactive-account rejection, role landing paths, and dashboard route protection.

#### Scenario: Unauthenticated dashboard access
- **WHEN** an unauthenticated request targets a dashboard route
- **THEN** an automated test verifies the request redirects to `/login`

#### Scenario: Inactive user access
- **WHEN** a session belongs to an inactive user
- **THEN** an automated test verifies protected server access or dashboard routing rejects the user

#### Scenario: Role landing redirect
- **WHEN** an authenticated user with a Parcel Flow role signs in or accesses a dashboard route outside their role scope
- **THEN** an automated test verifies the user is redirected to the correct role landing path

#### Scenario: Session shape validation
- **WHEN** Better Auth returns a session user missing required Parcel Flow metadata
- **THEN** an automated test verifies current-user loading fails instead of returning an incomplete user

### Requirement: Server authorization and validation coverage
The system SHALL include automated tests for server-side permission checks and Zod validation on protected mutations.

#### Scenario: Unauthorized mutation rejected
- **WHEN** a user role submits a protected mutation outside its permissions
- **THEN** an automated test verifies the server action returns or throws an authorization failure without writing data

#### Scenario: Invalid mutation input rejected
- **WHEN** a protected server action receives invalid input
- **THEN** an automated test verifies validation fails before persistence is attempted

#### Scenario: Authorized mutation accepted
- **WHEN** an authorized user submits valid input for a covered mutation
- **THEN** an automated test verifies the mutation succeeds and invalidates the appropriate server-rendered paths where applicable

### Requirement: Persistence integration coverage
The system SHALL include database-backed integration tests for persisted user, bank account, township, parcel, and rider-assignment behavior introduced by the auth and persistence foundation.

#### Scenario: User creation persists role-specific records
- **WHEN** an authorized admin creates an office admin, merchant, or rider test account
- **THEN** an integration test verifies the Better Auth user metadata and any role-specific profile records are persisted consistently

#### Scenario: Bank account primary enforcement
- **WHEN** a super admin creates or updates primary bank accounts for a user
- **THEN** an integration test verifies at most one bank account is primary for that user

#### Scenario: Township persistence
- **WHEN** an authorized admin creates or updates township pricing
- **THEN** an integration test verifies the township record is stored and later read through the DAL

#### Scenario: Parcel creation persistence
- **WHEN** an authorized admin creates a parcel with valid merchant and township references
- **THEN** an integration test verifies the parcel code, defaults, persisted fees, creator reference, and DTO read model are correct

#### Scenario: Rider assignment persistence
- **WHEN** an authorized admin assigns eligible unassigned parcels to an active rider
- **THEN** an integration test verifies `rider_id` and `assigned_at` are persisted and the affected read models reflect the assignment

### Requirement: Role-scoped read model coverage
The system SHALL include automated tests proving admins, merchants, and riders see only the persisted records allowed for their role.

#### Scenario: Merchant parcel visibility
- **WHEN** a merchant user reads parcel data
- **THEN** an automated test verifies only parcels belonging to that merchant are returned or displayed

#### Scenario: Rider parcel visibility
- **WHEN** a rider user reads parcel data
- **THEN** an automated test verifies only parcels assigned to that rider are returned or displayed

#### Scenario: Admin parcel management visibility
- **WHEN** an admin user reads parcel management data
- **THEN** an automated test verifies admin-scoped parcel controls and records are available according to the admin role

### Requirement: Playwright E2E regression coverage
The system SHALL include Playwright E2E tests that exercise critical browser workflows against a running Next.js application.

#### Scenario: Login and dashboard redirect
- **WHEN** a seeded user signs in with username and password through the browser
- **THEN** an E2E test verifies the user lands on the dashboard route appropriate for their role

#### Scenario: Admin creates operational data
- **WHEN** a seeded admin creates required operational records through the browser
- **THEN** an E2E test verifies user, township, and parcel flows submit successfully and display persisted results

#### Scenario: Admin assigns rider
- **WHEN** a seeded admin assigns eligible parcels to a rider through the browser
- **THEN** an E2E test verifies the assignment result is visible after the page refreshes

#### Scenario: Merchant and rider scoped pages
- **WHEN** seeded merchant and rider users open their parcel pages through the browser
- **THEN** E2E tests verify each user sees role-appropriate persisted parcel data and not admin-only management controls

### Requirement: Test data isolation and safety
The system SHALL prevent automated persistence tests from mutating non-test databases by default.

#### Scenario: Missing test database configuration
- **WHEN** database-backed tests are run without explicit test database configuration
- **THEN** the test harness refuses to run destructive setup or cleanup

#### Scenario: Deterministic seed data
- **WHEN** integration or E2E tests need authenticated users or domain records
- **THEN** the test harness creates deterministic test data with unique identifiers and cleans up records it owns where practical
