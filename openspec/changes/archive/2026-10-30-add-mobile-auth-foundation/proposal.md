## Why

Parcel Flow is getting a native Expo rider app, Android first (see `docs/mobile-app.md`). A native app can't call Next.js server actions or rely on browser cookies, so the server first needs a way to accept mobile sign-in and an authenticated, versioned API the app can call. This change is the server-only foundation the later mobile slices build on.

## What Changes

- Add the Better Auth Expo server plugin (`@better-auth/expo`) to `src/lib/auth.ts` so the Expo client can sign in with username and password and send the session on later requests.
- Add the app scheme (for example `parcelflow://`) and Expo development origins to Better Auth `trustedOrigins`, read from configuration.
- Add `GET /api/mobile/v1/me`, which returns the signed-in rider's profile and rejects missing sessions (401) and non-rider roles (403).
- Add a shared mobile API contract module at `src/features/mobile-api/contract.ts`: Zod schemas and TypeScript types for the response envelope and the `/me` payload, with no server-only imports, so the mobile app can import it later.
- Add a small route helper for the `{ ok, message, data? }` envelope and status mapping, reused by later `/api/mobile/v1` routes.
- Keep web sign-in, the inactive-account session guard, and demo-mode auth restrictions working unchanged.

## Capabilities

### New Capabilities

- `mobile-api-auth`: Mobile client sign-in through Better Auth, and the authenticated, rider-scoped `/api/mobile/v1` API foundation.

### Modified Capabilities

## Impact

- `src/lib/auth.ts`: new plugin and trusted origins.
- New `src/app/api/mobile/v1/me/route.ts`, `src/features/mobile-api/contract.ts`, and a route response helper under `src/features/mobile-api/server/`.
- New dependency: `@better-auth/expo`, at the version that matches `better-auth` 1.6.x.
- Environment: an optional `MOBILE_TRUSTED_ORIGINS` variable (comma-separated) documented in the env examples.
- Tests: unit tests for the `/me` route and the response helper; an integration test for mobile sign-in followed by `/me`.
- No database schema changes. No changes to the web UI.
