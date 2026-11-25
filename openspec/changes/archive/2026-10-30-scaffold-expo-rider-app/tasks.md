## 1. Scaffold and root tooling isolation

- [x] 1.1 Create the Expo SDK 58 app in `mobile/` (Expo Router with routes in `src/app/`, TypeScript strict), with `app.json` name "Parcel Flow", slug `parcel-flow`, scheme `parcelflow`, and Android package `com.parcelflow.rider`. Remove the template's sample screens.
- [x] 1.2 Use Bun with `mobile/bun.lock`. Pin `better-auth` and `@better-auth/expo` to `1.6.9`, and add `expo-secure-store`, `@tanstack/react-query`, `zod`, and `react-native-safe-area-context`.
- [x] 1.3 Exclude `mobile` in the root `tsconfig.json`, and add `mobile/**` to the `oxlint.config.ts` and `oxfmt.config.ts` ignore patterns. Confirm the root `lint`, `format:check`, `typecheck` and `build` are unchanged.
- [x] 1.4 Add the `lint`, `format`, `format:check`, `typecheck` and `test` scripts to `mobile/package.json` (oxlint, oxfmt, tsc, jest with `jest-expo`).

## 2. Configuration, theme and contract import

- [x] 2.1 Add `mobile/src/config.ts`, which reads `EXPO_PUBLIC_API_URL` and fails fast when it's missing, plus `mobile/.env.example` with LAN and deployed examples.
- [x] 2.2 Map `@parcel-flow/contract` to `../src/features/mobile-api/contract.ts` in `mobile/tsconfig.json`, `mobile/metro.config.js` (`watchFolders` plus a `resolveRequest` that aliases the contract and resolves its zod from `mobile/`) and the Jest `moduleNameMapper`.
- [x] 2.3 Add `mobile/src/theme/tokens.ts` from the `DESIGN.md` front matter, and the small primitives `Screen`, `Button`, `TextField` and `Notice`.

## 3. Auth and API clients

- [x] 3.1 Add `mobile/src/auth/client.ts` with the Better Auth Expo client (`expoClient` with secure-store storage, scheme `parcelflow`, plus `usernameClient`).
- [x] 3.2 Add `mobile/src/api/client.ts` with `apiGet(path, schema)`: it sends the session cookie, parses responses with the contract schemas, throws `MobileApiError`, and signs out locally on a 401.
- [x] 3.3 Add a `useMe()` TanStack Query hook. Set up the `QueryClient` provider in `app/_layout.tsx`, and clear the cache on sign-out.

## 4. Screens and auth gate

- [x] 4.1 Add the `app/(rider)/_layout.tsx` auth gate: a loading state while the session loads, and a redirect to `/sign-in` when there's no session.
- [x] 4.2 Add `app/sign-in.tsx` with username and password fields and a submit button showing a busy state. It handles the error messages from the design table (wrong credentials, inactive, non-rider via a `/me` 403, network), and redirects when already signed in.
- [x] 4.3 Add `app/(rider)/index.tsx`, the home screen: name, username, phone, the password-reset notice, a sign-out button, and loading/error states for `/me`.

## 5. Tests and CI

- [x] 5.1 Jest tests for the API client: it parses success responses, maps error envelopes to `MobileApiError`, and signs out on a 401.
- [x] 5.2 Jest tests for the sign-in screen: it shows the wrong-credentials, inactive and non-rider messages, and keeps the username after an error.
- [x] 5.3 Jest test for the auth gate: loading state, then a redirect when signed out and the home screen when signed in.
- [x] 5.4 Add a `mobile` job to `.github/workflows/ci.yml` that runs install, lint, format check, typecheck and test in `mobile/`, using the same pinned action SHAs.

## 6. Verification and docs

- [x] 6.1 Run the root checks (`lint`, `format:check`, `typecheck`, `test:unit`) and the `mobile/` checks. All pass.
- [x] 6.2 Run `bun run dev` with a seeded rider and `bun run start` in `mobile/`, then on the user's phone in Expo Go: sign in, see the profile, restart the app (still signed in), sign out, and check that a merchant gets the rider-only message. (Origin check done with curl: Expo Go's `exp://<ip>:8081` is accepted in development, an unknown origin gets 403. Confirmed on the user's Android phone: rider sign-in, profile, still signed in after a restart, sign-out, and the rider-only message for a merchant.)
- [x] 6.3 Update `docs/mobile-app.md`: a "Run the app" section (Expo Go, LAN API URL, trusted origins), the styling decision (StyleSheet + tokens instead of NativeWind), and the roadmap status.
