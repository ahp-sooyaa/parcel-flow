## Why

Slice 1 (`add-mobile-auth-foundation`) gave the server mobile sign-in and `GET /api/mobile/v1/me`. There is no app yet to use them. This slice creates the Expo rider app in `mobile/`: a rider can sign in, stay signed in across app restarts, see who they're signed in as, and sign out. Every later slice adds screens to this shell. See `docs/mobile-app.md` for the overall plan; this is slice 2 of 9.

## What Changes

- Create an Expo SDK 58 app in `mobile/` with its own `package.json` and `bun.lock`, using Expo Router and TypeScript strict.
- Add a Better Auth Expo client (pinned to the server's `better-auth` 1.6.9) that stores the session in `expo-secure-store`.
- Add a typed API client for `/api/mobile/v1` that sends the session, parses responses with the shared contract (`src/features/mobile-api/contract.ts`), and signs the rider out locally on a 401.
- Screens:
  - **Sign in**: username and password, with clear errors for wrong credentials, an inactive account, a non-rider account, and no network.
  - **Home**: the signed-in rider's name, username and phone, a password-reset notice when needed, and a sign-out button. The parcel list replaces it in slice 3.
- Auth gate: signed-out riders only see sign in; signed-in riders skip it, including after a cold start.
- Configuration: the API base URL comes from `EXPO_PUBLIC_API_URL`, so the app can point at the local dev server (over the LAN, for Expo Go on a phone) or a deployed environment.
- Theme tokens copied from `DESIGN.md`, used through React Native `StyleSheet`.
- Tooling:
  - The root `tsconfig.json`, oxlint and oxfmt ignore `mobile/`.
  - `mobile/` has its own lint, format, typecheck and Jest (`jest-expo`) scripts.
  - A new `mobile` job in `.github/workflows/ci.yml` runs them.
- Docs: update `docs/mobile-app.md` with how to run the app with Expo Go, and with the styling decision.

## Capabilities

### New Capabilities

- `mobile-rider-app-shell`: Rider sign-in, persistent session, auth gate, profile display, and sign-out in the native mobile app.

### Modified Capabilities

## Impact

- New `mobile/` folder (Expo app, its own dependencies and lockfile).
- Root config: `tsconfig.json` exclude, `oxlint.config.ts` and `oxfmt.config.ts` ignore patterns, `.github/workflows/ci.yml` (a new job).
- No server code, database or API changes. The web app, Railway build and existing tests are unchanged.
- Out of scope: the demo "Try as Rider" button (a later small change, since it needs a server endpoint), changing the password in the app, parcel screens, development builds, and EAS.
