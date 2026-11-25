## Context

Overall context and roadmap: `docs/mobile-app.md`. This is slice 2 of 9.

From slice 1, the server already has:

- Better Auth with the `expo()` plugin, and `trustedOrigins` with `parcelflow://` plus `MOBILE_TRUSTED_ORIGINS` (`src/lib/auth-trusted-origins.ts`). In development the plugin also trusts `exp://`.
- `GET /api/mobile/v1/me` behind `requireMobileRider()`: 401 means no session, 403 means inactive or not a rider.
- `src/features/mobile-api/contract.ts`: zod-only schemas (`mobileMeResponseSchema`, `mobileErrorResponseSchema`, `MOBILE_API_BASE_PATH`). It has no `@/` aliases.

Development setup: the Mac has no Android SDK or Java, and the user tests on their own Android phone with Expo Go. Expo Go on SDK 58 includes `expo-secure-store`, so this slice needs no native build.

## Goals / Non-Goals

**Goals:**

- A runnable Expo app in `mobile/` that a rider can sign in to with real credentials and stay signed in to.
- One API client and one auth client that later slices reuse unchanged.
- The mobile app imports the contract module from the server code.
- The web app's tooling and CI stay unaffected; `mobile/` gets its own CI job.

**Non-Goals:**

- Parcel screens or any new API endpoints.
- Demo login, changing the password in the app, push notifications, offline support.
- Development builds, EAS, app icons and splash art (slice 9).
- iOS-specific work. The code stays cross-platform, but only Android is checked.

## Decisions

### Expo SDK 58 + Expo Router, Bun as package manager

Use the latest stable SDK (58, React Native 0.88) with Expo Router's file-based routes. `mobile/` uses Bun, the same as the root, with its own `bun.lock`. It is not a Bun workspace, so the root `bun install` and the Railway build never install mobile dependencies.

Alternative considered: Bun workspaces. That would hoist React Native dependencies next to Next.js and risk version clashes (React 19.2 vs React Native's pinned React). Keeping the two installs separate is simpler.

### Route layout

```text
mobile/src/app/
├── _layout.tsx          # providers: QueryClient, SafeArea, Stack; config error screen
├── sign-in.tsx          # public
└── (rider)/
    ├── _layout.tsx      # auth gate: no session → <Redirect href="/sign-in" />
    └── index.tsx        # home: profile + sign out (replaced by parcels in slice 3)
```

The SDK 58 template keeps routes in `src/app/`. Every file there becomes a route, so screen tests live in `src/__tests__/` instead.

The gate reads `authClient.useSession()`. While the session loads from secure storage it shows a splash/loading state, never a flash of the sign-in screen. `sign-in.tsx` redirects to `/` when a session already exists.

### Better Auth Expo client, pinned to the server version

```ts
createAuthClient({
  baseURL: apiUrl,
  plugins: [
    expoClient({ scheme: "parcelflow", storagePrefix: "parcelflow", storage: SecureStore }),
    usernameClient(),
  ],
});
```

`better-auth` and `@better-auth/expo` are pinned to `1.6.9` in `mobile/package.json`, matching the server. Sign-in uses `authClient.signIn.username`. Sign-out calls `authClient.signOut()`, which also clears secure storage, and then clears the TanStack Query cache.

### API client

`mobile/src/api/client.ts` exports `apiGet(path, schema)`:

1. Sends `fetch(apiUrl + MOBILE_API_BASE_PATH + path)` with `Cookie: authClient.getCookie()` and `credentials: "omit"`.
2. Parses the JSON body with the given contract schema, or with `mobileErrorResponseSchema` when `ok` is false.
3. Throws a typed `MobileApiError` with `status` and `message`.
4. On a 401 it calls `authClient.signOut()` locally, so the gate redirects to sign in.

TanStack Query wraps it with `useMe()`. Later slices add `apiPost` / `apiPostForm` alongside it.

### Importing the shared contract

- `mobile/tsconfig.json` maps `@parcel-flow/contract` to `../src/features/mobile-api/contract.ts`.
- `mobile/metro.config.js` adds `../src/features/mobile-api` to `watchFolders`. A custom `resolveRequest` maps `@parcel-flow/contract` to the file, and resolves any bare import made from inside the contract folder (zod) as if it came from `mobile/`. This is narrower than `disableHierarchicalLookup`, which would also change how every package resolves its own nested dependencies.
- `mobile/tsconfig.json` also maps `zod` to `./node_modules/zod`, so the contract is typed against the same zod (the root has 4.4, mobile 4.6).
- Jest gets the same mappings through `moduleNameMapper`.
- Verified with `expo export --platform android`: the bundle contains the contract and exactly one zod copy, version 4.6.7 (mobile's).

Alternative considered: copying the schemas into `mobile/`. That's simpler, but the copies would drift; the whole point of the contract module is a single source of truth.

### API URL and Expo Go networking

`EXPO_PUBLIC_API_URL` is read in `mobile/src/config.ts`. When it's missing or not an http(s) URL, the root layout shows a configuration screen and makes no requests. For Expo Go on a phone it's the Mac's LAN address, for example `http://192.168.1.20:3000`. `next dev` already listens on `0.0.0.0`, so no extra flag is needed. `mobile/.env.example` documents this.

In Expo Go the client sends an `exp://<lan-ip>:8081` origin, not `parcelflow://`. Checked with curl against `next dev`: the plugin's development-only `exp://` entry accepts both `exp://192.168.1.20:8081` and `exp://192.168.1.20:8081/--/` on cookie-bearing requests, while `evil-app://` still gets 403. Local development needs no `MOBILE_TRUSTED_ORIGINS`. A deployed (production-mode) server tested from Expo Go needs `MOBILE_TRUSTED_ORIGINS=exp://`.

### Styling: StyleSheet + tokens, not NativeWind

`mobile/src/theme/tokens.ts` holds the colors, spacing and radii from the `DESIGN.md` front matter (primary `#1b1938`, ink `#292827`, hairline `#e8e4dd`, and so on). Screens use React Native `StyleSheet` and a few small primitives: `Button`, `TextField`, `Screen`, `Notice`.

This replaces the NativeWind choice in `docs/mobile-app.md`. NativeWind 4 depends on Tailwind 3 and a Babel/Metro setup, while the web is on Tailwind 4. For the handful of screens in v1, plain tokens are less setup and nothing to keep in step with SDK upgrades. The docs are updated to match.

### Error messages on sign in

| Server result                      | Message shown                                     |
| ---------------------------------- | ------------------------------------------------- |
| Wrong username or password         | "Incorrect username or password."                 |
| `ACCOUNT_INACTIVE` (session guard) | The server's inactive-account message             |
| Signed in, but `/me` returns 403   | The server's message, and the session is cleared  |
| Network failure                    | "Can't reach Parcel Flow. Check your connection." |

A merchant or admin can create a session (sign-in isn't role-gated), so after sign-in the app calls `/me`. On a 403 it signs out and shows the server's message. The server already distinguishes "The mobile app is only available to riders." from "Account is inactive.", so the app doesn't override it. The sign-in screen holds its redirect until `/me` succeeds, because Better Auth stores the session before the role is confirmed.

### Tooling isolation and CI

- Root `tsconfig.json` adds `"mobile"` to `exclude`. `oxlint.config.ts` and `oxfmt.config.ts` add `mobile/**` to `ignorePatterns`, so root checks and `next build` never see React Native code.
- `mobile/package.json` scripts: `lint` (oxlint), `format` / `format:check` (oxfmt), `typecheck` (`tsc --noEmit`), `test` (`jest`, with the `jest-expo` preset and `@testing-library/react-native` 14, where `render` and `fireEvent` are async). Lint and format use JSON configs (`.oxlintrc.json`, `.oxfmtrc.json`), because `mobile/package.json` can't be `"type": "module"` (Metro and Jest configs are CommonJS).
- `mobile/src/expo-types.d.ts` references `expo/types`, so typecheck works in a clean checkout and CI without the gitignored, generated `expo-env.d.ts`.
- The template's `.claude/` settings, Expo MIT `LICENSE`, `.vscode/` and sample screens were removed; `mobile/package.json` carries the repo's PolyForm license.
- CI adds a `mobile` job with `working-directory: mobile`: install with `bun install --frozen-lockfile`, then lint, format check, typecheck and test. It uses the same pinned action SHAs as the `checks` job.

## Risks / Trade-offs

- [Expo Go origin matching] Resolved: the development `exp://` entry matches Expo Go origins (see above). No server code change.
- [Cookie name prefix] The server uses the default `better-auth.` cookie prefix, and `expoClient` must store and send the same cookie → covered by the end-to-end check on the phone.
- [Metro resolving outside the project] `watchFolders` with a path outside `mobile/` can confuse caching → if the contract import is unreliable, fall back to a build-time copy script and note it in the design.
- [Expo Go limits] Expo Go can't use custom native modules. Slice 5 (camera) may still work in Expo Go via `expo-image-picker`, but if not, it moves to an EAS development build.

## Migration Plan

Only additive changes. Rollback is deleting `mobile/` and the four root config edits.
