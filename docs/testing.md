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

The regression suite covers auth, route protection, role authorization, user/profile/bank-account persistence, township persistence, parcel creation, rider assignment, role-scoped parcel visibility, and parcel correction behavior.

Parcel correction coverage includes:

- status and rider correction authorization and validation;
- required correction reason and stale-state rejection;
- transactional parcel and eligible pending financial item reconciliation;
- blocking corrections that would mutate reserved or settled financial items;
- correction audit history and admin-only correction UI.

The `add-rider-payouts` change must add focused unit, component, and integration coverage for:

- one `delivery_attempt` way when an assigned rider starts delivery;
- preserving that way after failure, `postpone`, or `canceled_returned`;
- creating another way when a postponed parcel is retried;
- one `merchant_return` way for the rider who completes assigned return work;
- preserving way ownership when different riders perform the delivery attempt and merchant return;
- delivered corrections preserving the existing attempt, correcting only the latest eligible attempt rider, and rejecting corrections with no real delivery attempt;
- deduction-only manual return corrections and legacy rider-way sources not suppressing merchant-return credits;
- payout eligibility, draft creation, stale selection rejection, cancellation, settlement, and authorization;
- rider payout table and right-side create-sheet item status behavior.

R2 upload integration and full browser coverage for settlement and payout completion remain outside the current regression baseline until their dedicated flows add those tests.

## Performance benchmarking

Local performance benchmarks help verify query and page-load optimizations before and after changes. Benchmarks run against `.env.test` (local Supabase Postgres on port `54322` is supported).

### Commands

```bash
bun run perf:seed
bun run perf:dal
bun run perf:explain
bun run perf:pages
bun run perf:lighthouse
bun run perf:all
bun run perf:compare <baseline-dir> <candidate-dir>
```

`perf:seed` resets parcel data by default (`PERF_RESET=1`) and removes previous perf-tagged users/parcels for the current `PERF_SEED` before re-seeding, so reruns are safe. Set `PERF_RESET=0` to only replace perf-tagged parcels without wiping unrelated parcel rows.

Scale presets:

```bash
PERF_SCALE=small bun run perf:seed    # ~100 parcels
PERF_SCALE=medium bun run perf:seed   # ~1,000 parcels
PERF_SCALE=large bun run perf:seed    # ~10,000 parcels
```

Reproducible seeding:

```bash
PERF_SEED=42 PERF_SCALE=medium bun run perf:dal
```

### Workflow

1. Start local Supabase / test database and ensure `.env.test` is configured.
2. Run `bun run perf:dal` (or `perf:all`) and copy the output directory from `benchmarks/results/<timestamp>/` into `benchmarks/baselines/`.
3. Apply the optimization.
4. Re-run benchmarks and compare:

```bash
bun run perf:compare benchmarks/baselines/pre-optimization benchmarks/results/<new-timestamp>
```

### Output artifacts

Each run writes JSON under `benchmarks/results/<timestamp>/`:

- `manifest.json` — commit, scale, Bun version, commands run
- `dal.json` — DAL function p50/p95 timings
- `explain-*.json` — Postgres `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` snapshots
- `pages.json` — Playwright page load metrics on a production build
- `lighthouse.json` — Lighthouse performance scores for `/login` (mobile + desktop). Dashboard routes are covered by `pages.json`.

`perf:pages` and `perf:lighthouse` expect the app on `PLAYWRIGHT_PORT` (default `3100`). `perf:pages` builds and starts the production server automatically.

Lighthouse env vars:

- `LIGHTHOUSE_AUDIT_TIMEOUT_MS` — max time per CLI audit (default `120000`)
- `LIGHTHOUSE_MAX_WAIT_FOR_LOAD_MS` — Lighthouse `--max-wait-for-load` (default `60000`)
- `LIGHTHOUSE_PAUSE_BETWEEN_AUDITS_MS` — pause between audits (default `2000`)
- `PERF_SKIP_LIGHTHOUSE=1` — skip step 5 in `perf:all`
- `PERF_STRICT_LIGHTHOUSE=1` — fail `perf:all` when Lighthouse fails (default: warn and continue)

### Supabase MCP (ad-hoc checks)

Use Supabase MCP alongside local benchmarks:

- `get_advisors` with `type: "performance"` for index and RLS advisories
- `execute_sql` for remote `EXPLAIN` comparisons when hosted behavior differs from local

MCP does not replace the local harness for repeatable before/after numbers.

### Benchmark coverage (performance audit plan)

Benchmarks map to the performance bottleneck audit plan so `perf:compare` can validate each optimization phase.

| Audit item                                        | DAL benchmark                                                                               | EXPLAIN snapshot                                                        | Page benchmark                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Admin parcels triple-scan                         | `adminParcelsPageDataLoad`                                                                  | —                                                                       | `/dashboard/parcels`                                 |
| Unpaginated admin parcel list                     | `listParcels`                                                                               | `listParcels`                                                           | `/dashboard/parcels`                                 |
| Merchant pagination reference                     | `listMerchantParcelsPageForUser`                                                            | `listMerchantParcelsPageForUser`                                        | `/dashboard/merchant/parcels`                        |
| `listMerchants` / `listRiders` parcel aggregation | `listMerchants`, `listRiders`                                                               | `listMerchantsParcelAggregation`, `listRidersParcelAggregation`         | —                                                    |
| Missing indexes on hot tables                     | —                                                                                           | all `explain-*.json` (check for seq scans on `parcels`)                 | —                                                    |
| Users page bank-account N+1                       | `usersPageBankAccountsLoad`                                                                 | —                                                                       | `/dashboard/users`                                   |
| `recomputeParcelRiderPayoutStatuses` N+1 writes   | `recomputeParcelRiderPayoutStatuses`                                                        | —                                                                       | —                                                    |
| Dashboard settlement workspace                    | `dashboardPageDataLoad`, `listEligibleSettlementMerchants`, `listPendingRiderCashHandovers` | `listEligibleSettlementFinancialItems`, `listPendingRiderCashHandovers` | `/dashboard`                                         |
| `getParcelSummary` full-table scan                | `getParcelSummary`                                                                          | `getParcelSummary`                                                      | `/dashboard`                                         |
| Rider parcels client pagination                   | `listParcelsForRiderUser`                                                                   | `listParcelsForRiderUser`                                               | `/dashboard/rider/parcels`                           |
| Settlement / payout lists                         | `listSettlements`, `listRiderPayouts`, `listEligibleRiderPayoutRiders`                      | —                                                                       | `/dashboard/settlements`, `/dashboard/rider-payouts` |

`perf:seed` creates login-capable perf users (`perf-<seed>-super-admin`, `perf-<seed>-merchant`, `perf-<seed>-rider-1`; password `password123`), financial items for settlement/payout eligibility, and sample settlement/payout history. Page benchmarks use the same seeded volume as DAL benchmarks.

Recommended baseline scale for index and aggregation work:

```bash
PERF_SCALE=medium bun run perf:all
cp -R benchmarks/results/<timestamp> benchmarks/baselines/pre-optimization
```

Use `PERF_SCALE=large` before claiming index wins when seq scans are still acceptable at medium scale.

### Suggested thresholds (manual)

| Layer      | Metric                                      | Investigate when                          |
| ---------- | ------------------------------------------- | ----------------------------------------- |
| DAL        | p95 latency                                 | >15% slower than baseline                 |
| EXPLAIN    | Sequential scan on `parcels` at large scale | Still present after index/pagination work |
| Playwright | Time to key content                         | >20% slower than baseline                 |
| Lighthouse | LCP on `/login`                             | >10% slower than baseline                 |
