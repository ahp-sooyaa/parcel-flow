# Testing

Parcel Flow uses Bun for unit and integration tests and Playwright for browser E2E tests.

## Commands

```bash
bun run test
bun run test:unit
bun run test:integration
bun run test:coverage
bun run test:e2e
bun run test:all
```

`test` is the fast local command and runs unit/component tests only. Integration and E2E tests load `.env.test` for the local database-backed flows.

## First-time Playwright setup

```bash
bunx playwright install chromium
```

## Integration Test Database

Database-backed tests use `DATABASE_URL` from `.env.test`. The database name must contain `test` or `ci`; helpers refuse to run against other database names to avoid mutating development or production data.

The exception is Supabase local development. The helper allows the standard local Supabase Postgres URL:

```bash
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Run the local integration flow with:

```bash
bun run test:integration
```

The migration step is also available directly:

```bash
bun run test:db:migrate
```

`test:integration` runs migrations first, then executes the suite against `DATABASE_URL`.

## Coverage

Run Bun coverage for unit, component, and integration tests with:

```bash
bun run test:coverage
```

That command runs migrations first, then executes Bun tests with `--coverage` against `tests/unit`, `tests/components`, and `tests/integration`.

It intentionally runs unit/component coverage and integration coverage in separate Bun processes. Some unit tests use `mock.module(...)`, and isolating the processes prevents those mocks from leaking into the integration suite during coverage runs.

E2E coverage is not included in `test:coverage`. Playwright coverage should be configured and reported separately from the Bun test runner.

## E2E Seed Users

Playwright loads `.env.test`, starts the Next.js app with Bun, and uses `PLAYWRIGHT_PORT` or port `3100` by default.

Playwright tests need seeded users because they test the real login page in a browser. Seed deterministic users and baseline domain records with:

```bash
bun run test:e2e:seed
```

Run the full local E2E flow with:

```bash
bun run test:e2e
```

That command runs migrations, seeds E2E data, starts the app through Playwright, and runs the browser tests.

The seed script uses these credentials, with defaults shown below:

```bash
E2E_SUPER_ADMIN_USERNAME=e2e-super-admin
E2E_SUPER_ADMIN_PASSWORD=password123
E2E_OFFICE_ADMIN_USERNAME=e2e-office-admin
E2E_OFFICE_ADMIN_PASSWORD=password123
E2E_MERCHANT_USERNAME=e2e-merchant
E2E_MERCHANT_PASSWORD=password123
E2E_RIDER_USERNAME=e2e-rider
E2E_RIDER_PASSWORD=password123
```

The seed script creates or updates:

- `e2e-super-admin`
- `e2e-office-admin`
- `e2e-merchant`
- `e2e-rider`
- one active township
- one merchant profile
- one rider profile with service township
- one unassigned parcel for assignment tests
- one rider-assigned parcel for scoped rider page tests

## Scope

The regression suite covers auth, route protection, role authorization, user/profile/bank-account persistence, township persistence, parcel creation, rider assignment, and role-scoped parcel visibility.

Settlement completion, payout completion, delivery status side effects, and R2 uploads remain out of scope for this test change.
