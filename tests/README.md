# Test Strategy

This repository uses Bun to run all tests.

## Layer Mix (70/20/10 by test cases)

- `tests/unit/**`: ~70% of cases for pure logic and DTO/validation behavior.
- `tests/integration/**`: ~20% of cases for server actions and authorization flow with mocked external boundaries.
- `tests/e2e/**`: ~10% of cases for access-control smoke tests in Playwright.

## Commands

- `bun run test:unit`
- `bun run test:integration`
- `bun run test:e2e`
- `bun run test:coverage`
- `bun run test`

## E2E Auth Stub

Playwright tests use `AUTH_E2E_STUB_MODE=1` and send the `x-parcel-flow-e2e-auth` header.
This enables deterministic auth/authz scenarios without real Supabase login flows.
The stub mode is test-only and disabled unless explicitly enabled.
