## Context

Overall context and roadmap: `docs/mobile-app.md`. This is slice 1 of 9.

Auth today is Better Auth 1.6 (`src/lib/auth.ts`) with the `username`, `admin`, and `nextCookies` plugins. Sessions are cookies set by `/api/auth/[...all]`. Server code reads the user with `getCurrentUser()` / `requireCurrentUser()` in `src/lib/session.ts`, which calls `auth.api.getSession({ headers })` and validates the Parcel Flow user fields. A `session.create.before` hook (`src/lib/auth-session-guard.ts`) refuses sessions for inactive users. `src/proxy.ts` handles dashboard route guards and excludes `/api`. One rider route handler already exists (`src/app/api/rider/parcels/deliver/route.ts`) and uses a `{ ok, message }` JSON envelope.

## Goals / Non-Goals

**Goals:**

- A mobile client can sign in with username and password and call authenticated API routes.
- `/api/mobile/v1` route handlers use the same `requireCurrentUser()` as the rest of the server.
- A small, framework-free contract module the mobile app can import later.
- A reusable response helper so every mobile route returns the same envelope and status codes.

**Non-Goals:**

- The Expo app itself (slice 2).
- Parcel endpoints, or moving server-action logic into shared operations (slices 3 to 7).
- Bearer tokens, refresh tokens, or a custom auth scheme.
- Merchant or admin mobile access.

## Decisions

### Use the Better Auth Expo plugin, not the bearer plugin

`@better-auth/expo` is the official integration. The Expo client stores the session cookie in `expo-secure-store` and sends it as a `Cookie` header, so `auth.api.getSession({ headers })` and therefore `requireCurrentUser()` work without changes. The server plugin also handles the missing browser `Origin` header by trusting the `expo-origin` header the client sends, checked against `trustedOrigins`.

Alternative considered: the `bearer()` plugin with a custom token header. That works too, but it adds a second session transport for server code to reason about and gives up the official Expo client helpers.

### Trusted origins from configuration

`trustedOrigins` gets the production app scheme (`parcelflow://`) by default, plus values from an optional `MOBILE_TRUSTED_ORIGINS` env var (comma-separated) for Expo Go and development builds such as `exp://`. Only explicit values are trusted; there are no wildcards in production.

### Role gate at the route, not in the proxy

`/api/mobile/v1/me` calls `requireCurrentUser()` and then checks `role === "rider"`. A missing or invalid session returns 401; an inactive account or a non-rider role returns 403. Later rider routes reuse the same guard through a helper, `requireMobileRider()`, so the rule lives in one place. The proxy stays untouched because it excludes `/api`.

### Contract module with no server imports

`src/features/mobile-api/contract.ts` imports only `zod` and holds the envelope schema and `MobileMeDto`, a subset of `CurrentUser`: id, name, username, phone number, role, and `mustResetPassword`. It deliberately leaves out the internal email and address. Slice 2 decides how `mobile/` consumes it (a Metro `watchFolders` path alias); this change only guarantees the module is safe to import outside Next.js. A unit test checks that it does not import `server-only`, `next/*`, or `@/db`.

### Response helper

`src/features/mobile-api/server/response.ts` exports `mobileOk(data, message)` and `mobileError(status, message)`, returning `NextResponse.json` with the shared envelope. Messages for unexpected errors stay generic in production, the same way existing routes avoid leaking internals.

## Risks / Trade-offs

- [Demo mode auth allowlist] Demo mode only allows certain `/api/auth/*` endpoints (`isAllowedAuthEndpointInDemo` in `src/lib/demo.ts`) → confirm the Expo client uses only sign-in, sign-out, and get-session, and add a unit test that a mobile-style sign-in is still allowed.
- [`use cache: private` in route handlers] `getCurrentUser()` is privately cached → it's already used by the deliver route, but the integration test should cover a session that is signed out and then reused, to check the route refuses it.
- [Version drift] `@better-auth/expo` must match `better-auth` 1.6.x → pin both versions together.
- [CSRF] Trusting `expo-origin` widens the accepted origins → keep the list explicit and configuration-driven.
- [Origin check scope] Better Auth checks origins as CSRF protection: only on requests that carry cookies, or browser requests with Fetch Metadata headers. A cookie-less first sign-in from a native client is gated by the password and the sign-in rate limit, not the origin. Better Auth also turns origin checks off when it detects a test run, so origin rejection is verified with `curl` against the dev server instead of in the integration tests.

## Migration Plan

Only additive changes. The web login flow and cookies are unchanged. Rollback is removing the plugin, the trusted origins, and the new route.
