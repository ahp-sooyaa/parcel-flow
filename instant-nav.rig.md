# instant-nav rig: parcel-flow-v2

- BUILD: `EXPOSE_TESTING_API=1 bun --env-file=.env.test next build && EXPOSE_TESTING_API=1 bun --env-file=.env.test next start --hostname 127.0.0.1 --port 3100` (local production build; never `next dev` for instant() verdicts)
- EXPOSE: `process.env.EXPOSE_TESTING_API === "1"` wired to `experimental.exposeTestingApiInProductionBuild`
- RUN: `bun --env-file=.env.test playwright test -c playwright.instant.config.ts` against `PLAYWRIGHT_BASE_URL` / default `http://127.0.0.1:3100` (config `webServer` builds+starts production server when not already running)
- TEST USER: e2e super admin (`E2E_SUPER_ADMIN_USERNAME` / `E2E_SUPER_ADMIN_PASSWORD`, defaults `e2e-super-admin` / `password123`) via Playwright `storageState` from `tests/e2e/auth.setup.ts` (API sign-in to `/api/auth/sign-in/username`); role `super_admin` with seeded dashboard data from `bun run test:e2e:seed`
- DRIFT: seeded vs empty DB; role-scoped nav (super_admin sees all links; merchant/rider/office_admin do not); env files (`.env.test` vs `.env.development`); Sentry tunnel rewrite; proxy CSP headers; production build vs previous `next dev` e2e harness
- LOOP: local build → start → playwright; fully agent-drivable; no deploy wait. Stop previous server on port 3100 before start; fail on `EADDRINUSE`
- LIVENESS: n/a for local `build && start` (artifact is freshly built)
- WALLS:
  - Existing `playwright.config.ts` webServer uses `next dev` — instant-nav uses `playwright.instant.config.ts` instead
  - `bun --bun next build/start` breaks CommonJS chunk loading on Next 16.3 — use Node `next` binaries
  - Dashboard auth is enforced in both `proxy.ts` and layout/page session reads; proxy is the routing gate, layout session is for nav/UI
  - After `instant()` clears the testing cookie, deferred RSC payloads do not always resume in Next 16.3.0; instant-nav tests reload once after unlock to confirm dynamic content can load. Under-lock assertions remain the instant-shell verdict
  - Playwright browsers must be installed (`npx playwright install chromium`) when the sandbox cache lacks the pinned browser build
