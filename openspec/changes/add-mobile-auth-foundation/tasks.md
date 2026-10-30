## 1. Better Auth Expo setup

- [x] 1.1 Add `@better-auth/expo` at the version that matches `better-auth` 1.6.x, and pin both.
- [x] 1.2 Register the `expo()` server plugin in `src/lib/auth.ts`, keeping the existing plugins and the inactive-user session guard.
- [x] 1.3 Add `trustedOrigins` with the `parcelflow://` app scheme plus comma-separated `MOBILE_TRUSTED_ORIGINS` values, and document the variable in the env example files.
- [x] 1.4 Confirm the demo-mode auth endpoint allowlist (`src/lib/demo.ts`) still allows mobile sign-in, sign-out, and get-session, and extend `tests/unit/demo-mode.unit.test.ts` if needed.

## 2. Mobile API contract and helpers

- [x] 2.1 Create `src/features/mobile-api/contract.ts` with the response envelope schema and the `MobileMeDto` schema and type (id, name, username, phone number, role, `mustResetPassword`).
- [x] 2.2 Create `src/features/mobile-api/server/response.ts` with `mobileOk` and `mobileError` helpers that return the shared envelope.
- [x] 2.3 Create `requireMobileRider()` in `src/features/mobile-api/server/` that wraps the session read, returning 401 for a missing session and 403 for inactive or non-rider users.

## 3. Current user endpoint

- [x] 3.1 Add `src/app/api/mobile/v1/me/route.ts` (`GET`), which uses `requireMobileRider()` and maps `CurrentUser` to `MobileMeDto`.
- [x] 3.2 Make sure the response never includes the internal email, address, or session values.

## 4. Tests

- [x] 4.1 Unit test the `/me` route with a mocked session: rider → 200 with the DTO; no session → 401; merchant/admin → 403; inactive → 403.
- [x] 4.2 Unit test that `contract.ts` has no imports from `next/*`, `@/db`, `server-only`, or `@/lib/auth`.
- [x] 4.3 Integration test: sign in as a seeded rider through the Better Auth handler with an `expo-origin` header, then call `/api/mobile/v1/me` with the returned cookie.
- [x] 4.4 Integration test that an inactive rider can't sign in. Untrusted-origin rejection is checked manually in 5.2, because Better Auth turns origin checks off when it detects a test run.

## 5. Verification and docs

- [x] 5.1 Run `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run test:unit`, and `bun run test:integration`.
- [x] 5.2 Manual check with `curl` against the local dev server: sign in with the expo origin header, call `/api/mobile/v1/me`, confirm an untrusted origin gets 403 on a cookie-bearing request, then sign out → 401.
- [ ] 5.3 Mark slice 1 in the roadmap table in `docs/mobile-app.md` as done after archive.
