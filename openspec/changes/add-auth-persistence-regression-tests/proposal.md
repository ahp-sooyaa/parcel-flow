## Why

The `wire-auth-and-persistence-foundation` implementation now carries core authentication, authorization, and persisted workflow behavior, but the project lacks automated regression coverage for those paths. Adding unit, integration, and E2E tests now reduces the chance that future feature work breaks login, role access, data persistence, or the main parcel operations.

## What Changes

- Add a Bun-based unit and integration test foundation for server utilities, DAL/action behavior, and React components.
- Add happy-dom and React Testing Library setup for client component tests.
- Add Playwright E2E setup that runs with the Bun-managed app scripts.
- Add focused regression tests for Better Auth session handling, role guards, protected routes, persisted user/township/parcel/rider-assignment behavior, and critical UI flows.
- Add package scripts and test configuration so contributors can run unit, integration, E2E, and combined regression checks consistently.
- Document required local test environment assumptions, including database isolation and seeded test users.

## Capabilities

### New Capabilities

- `auth-persistence-regression-testing`: Automated regression coverage for the auth, route protection, role authorization, and persisted MVP data flows introduced by `wire-auth-and-persistence-foundation`.

### Modified Capabilities

None.

## Impact

- Affects test tooling and scripts in `package.json` and test configuration files.
- Adds test setup files, fixtures, and helpers under repo-appropriate test locations.
- Adds unit and integration coverage for `src/lib`, `src/proxy.ts`, `src/features/*/server`, and selected feature components.
- Adds Playwright E2E coverage for login, dashboard routing, users, townships, parcel creation, merchant/rider visibility, and rider assignment.
- Introduces development/test dependencies for Bun test, happy-dom, React Testing Library, and Playwright.
