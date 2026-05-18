## 1. Test Tooling Setup

- [x] 1.1 Add unit/integration test dependencies for Bun test, happy-dom, React Testing Library, and user-event.
- [x] 1.2 Add Playwright test dependency and browser install/setup documentation for Bun-managed local development.
- [x] 1.3 Add package scripts for `test`, `test:unit`, `test:integration`, `test:e2e`, and `test:all`.
- [x] 1.4 Add Bun test preload/setup files for DOM globals, React Testing Library cleanup, and shared test environment defaults.
- [x] 1.5 Add Playwright configuration that starts the Next.js app through Bun scripts and targets a test base URL.

## 2. Test Fixtures and Safety Guards

- [x] 2.1 Create shared unit test builders for Parcel Flow users, sessions, roles, form inputs, and DTO expectations.
- [x] 2.2 Create database integration test helpers for connecting to an explicit test database and refusing unsafe database URLs.
- [x] 2.3 Create deterministic seed helpers for auth users, merchant profiles, rider profiles, townships, parcels, and bank accounts.
- [x] 2.4 Add cleanup helpers that remove only test-owned records created by the current suite.
- [x] 2.5 Document required environment variables and local setup commands for integration and E2E tests.

## 3. Auth, Session, and Route Unit Tests

- [x] 3.1 Add unit tests for `getRoleLandingPath` covering super admin, office admin, merchant, and rider roles.
- [x] 3.2 Add unit tests for `getCurrentUser` mapping complete Better Auth session metadata to the Parcel Flow current-user shape.
- [x] 3.3 Add unit tests for `getCurrentUser` rejecting sessions with missing or invalid Parcel Flow metadata.
- [x] 3.4 Add unit tests for `requireCurrentUser` rejecting unauthenticated and inactive users.
- [x] 3.5 Add proxy tests for unauthenticated dashboard redirects, inactive session redirects, allowed role paths, and out-of-scope role redirects.
- [x] 3.6 Add permission utility tests for user management, bank account, parcel, township, rider assignment, merchant, and rider access decisions.

## 4. Server Action and DAL Integration Tests

- [x] 4.1 Add validation and authorization tests for user create/update actions, including unauthorized role combinations.
- [x] 4.2 Add integration tests proving user creation persists Better Auth metadata and role-specific merchant/rider records.
- [x] 4.3 Add integration tests for bank account create/update behavior and at-most-one-primary enforcement.
- [x] 4.4 Add integration tests for township create/update actions and DAL readback.
- [x] 4.5 Add integration tests for parcel creation defaults, code generation, referenced merchant/township validation, and DTO readback.
- [x] 4.6 Add integration tests for rider assignment validation, transactional persistence of `rider_id` and `assigned_at`, and refreshed read models.
- [x] 4.7 Add role-scoped read model tests for admin parcel management, merchant parcel visibility, and rider parcel visibility.

## 5. Component Tests

- [x] 5.1 Add happy-dom React Testing Library tests for the login form validation/submission states and username preservation after errors.
- [x] 5.2 Add component tests for user create/edit form role-specific fields and submit wiring.
- [x] 5.3 Add component tests for township create/edit form validation affordances and persisted-success callbacks.
- [x] 5.4 Add component tests for parcel create/edit forms covering required fields, conditional COD fields, township/merchant selection, and submit wiring.
- [x] 5.5 Add component tests for parcel table/list role-specific controls, assignment selection disabling, and empty/loading states where present.
- [x] 5.6 Add component tests for `AssignRiderDialog` selection summary, invalid submit prevention, and successful confirm handling.

## 6. Playwright E2E Tests

- [x] 6.1 Add E2E seed setup for deterministic super admin, office admin, merchant, rider, township, and parcel records.
- [x] 6.2 Add E2E tests for unauthenticated dashboard redirect and username/password login.
- [x] 6.3 Add E2E tests for role landing redirects and role-scoped sidebar/dashboard navigation.
- [x] 6.4 Add E2E tests for admin creating a user and verifying the persisted row appears after navigation or refresh.
- [x] 6.5 Add E2E tests for admin creating/updating a township and verifying the persisted result appears in relevant selectors or tables.
- [x] 6.6 Add E2E tests for admin creating a parcel and verifying the persisted parcel appears in the admin parcel list.
- [x] 6.7 Add E2E tests for assigning a parcel to a rider and verifying the assignment persists after refresh.
- [x] 6.8 Add E2E tests for merchant and rider parcel pages showing scoped persisted data without admin-only controls.

## 7. Verification and Documentation

- [x] 7.1 Run `bun test` for fast unit/component coverage and fix failures.
- [x] 7.2 Run the integration test command against an explicit test database and fix failures.
- [x] 7.3 Run Playwright E2E tests against the Bun-started app and fix failures.
- [x] 7.4 Run lint, typecheck, and build after adding the test harness and coverage.
- [x] 7.5 Update project documentation or setup notes with the testing strategy, commands, and test database safety requirements.
- [x] 7.6 Confirm the new tests do not cover out-of-scope settlement completion, payout completion, delivery status side effects, or R2 uploads.
