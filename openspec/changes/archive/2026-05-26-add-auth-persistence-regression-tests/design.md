## Context

Parcel Flow is a Bun-managed Next.js App Router monolith with Better Auth, Drizzle, Supabase PostgreSQL, shadcn/ui, and feature-sliced server/client code. The `wire-auth-and-persistence-foundation` change replaced mock behavior with real sessions, role guards, server actions, Drizzle DAL reads/writes, and persisted parcel workflows. Those paths have been manually verified but are not protected by automated regression tests.

The current `package.json` has lint, format, typecheck, build, and database scripts, but no test scripts, DOM test setup, test fixtures, or E2E harness. The test design must fit the existing monolith, keep permission checks on the server, and avoid placing business logic outside the established feature slices.

## Goals / Non-Goals

**Goals:**

- Provide a repeatable Bun-based unit and integration test foundation for server utilities, permission rules, server actions, DAL mapping, and component behavior.
- Provide happy-dom and React Testing Library support for component tests that need a browser-like DOM.
- Provide Playwright E2E coverage for the critical authenticated flows introduced by the auth and persistence foundation.
- Keep database-backed tests isolated, deterministic, and explicit about seed data.
- Add scripts that make the expected test layers clear for local development and CI.

**Non-Goals:**

- Do not replace manual exploratory testing for full business workflow acceptance.
- Do not introduce a separate backend, test microservice, or alternate application runtime.
- Do not create broad snapshot tests that lock incidental markup.
- Do not cover out-of-scope product behavior from the prior change, including settlement completion, rider payout completion, delivery status progression side effects, and R2 uploads.
- Do not bypass server permission checks by testing only client-side affordances.

## Decisions

### Use Bun test as the unit and integration runner

Unit and integration tests should run through `bun test` so the test command matches the project package manager and runtime. Tests should use Bun's built-in test APIs, mocks where appropriate, and TypeScript directly.

Alternative considered: add Vitest. Vitest has a strong ecosystem, but it adds another runner and configuration layer when the requested stack and project runtime are already Bun-based.

### Split tests by behavior, not by framework internals

Tests should be organized around regression surfaces such as auth/session, permissions, users, townships, parcels, assignment, and dashboard UI behavior. File placement may use colocated `*.test.ts(x)` files or a top-level `tests/` tree, but helpers and fixtures should stay clearly separated from production code.

Alternative considered: mirror every source folder mechanically. That makes coverage look complete while encouraging brittle tests around implementation shape instead of user-visible or contract-level behavior.

### Use isolated database-backed integration tests for persistence

DAL and server action tests that prove persistence should use a dedicated test database or isolated test schema configured by environment variables. Each integration test suite should seed only the records it needs and clean up records it created. Tests must not run against a shared development or production database by default.

Alternative considered: mock Drizzle for all integration tests. That is faster, but it would miss schema, transaction, join, constraint, and DTO-mapping regressions, which are the main risks after persistence wiring.

### Mock external framework boundaries in focused unit tests

Tests for pure utilities and permission rules should avoid the database. Tests for `getCurrentUser`, `requireCurrentUser`, proxy redirects, and server actions may mock Better Auth, Next headers, `revalidatePath`, and current-user helpers when the goal is authorization branching or validation behavior rather than adapter correctness.

Alternative considered: make every auth test hit Better Auth end-to-end. That gives confidence for a few flows, but it would make low-level branch coverage slower and harder to diagnose.

### Use React Testing Library with happy-dom for component behavior

Component tests should cover form validation affordances, submitted state, role-specific rendering, table/combobox interactions, and callback wiring using React Testing Library in a happy-dom environment. Tests should prefer accessible queries and avoid structural snapshots.

Alternative considered: test components only through Playwright. E2E tests are necessary, but they are too slow and coarse for every stateful component branch.

### Use Playwright for authenticated E2E smoke/regression flows

Playwright tests should start the Next app using Bun-managed scripts and exercise complete browser flows: unauthenticated redirects, username login, role landing redirects, role-scoped navigation, user creation, township creation/update, parcel creation, rider assignment, and merchant/rider parcel visibility. E2E setup should create or reuse deterministic test users and isolate test-created data.

Alternative considered: use only server action integration tests for flows. That misses route protection, browser form behavior, redirects, and role-specific UI state.

### Add explicit scripts for each test layer

Package scripts should distinguish fast tests from database and browser tests, for example `test`, `test:unit`, `test:integration`, `test:e2e`, and `test:all`. CI can choose the right level based on available database and browser dependencies.

Alternative considered: make one `test` command run everything. That is simple, but it makes fast local feedback depend on database and browser setup.

## Risks / Trade-offs

- Database tests accidentally point at a non-test database -> Require a test-specific environment variable or database name guard before running destructive cleanup.
- Better Auth internals are hard to seed directly -> Prefer public auth APIs for E2E seed users where feasible, and keep direct table inserts limited to domain records that are not auth-owned.
- Playwright tests become slow or flaky -> Keep E2E coverage to critical happy paths and authorization boundaries, and cover branch-heavy cases in Bun integration tests.
- Component tests become coupled to shadcn markup -> Use accessible labels, roles, and user-facing text instead of class names or snapshots.
- Bun compatibility gaps appear in testing libraries -> Keep setup minimal, pin required dev dependencies, and verify with local `bun test` before expanding coverage.
- Parallel tests contend for shared records -> Use unique test IDs, seeded usernames, and per-test cleanup for records created by each suite.
