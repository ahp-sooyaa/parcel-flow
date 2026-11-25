## Context

Slices 1–8 built the rider app and its API. It runs in Expo Go only: `EXPO_PUBLIC_API_URL` comes from `mobile/.env` (often a LAN `http://` address), there is no `eas.json`, and the icons and splash are the Expo template. `app.json` already has the package `com.parcelflow.rider`, the `parcelflow` scheme and the splash plugin. The server trusts `parcelflow://` as an origin since slice 1, so a release build can sign in without server changes.

Facts from the Expo docs this design relies on (checked on 2026-11-02):

- `eas build` uploads the project minus gitignored files, so `mobile/.env` never reaches the build server. `EXPO_PUBLIC_*` values come from the EAS environment named by the profile's `environment` key (`development`, `preview`, `production`), set with `eas env`.
- `"cli": { "appVersionSource": "remote" }` makes EAS store `versionCode` and ignore it in `app.json`; `autoIncrement: true` bumps it per build. `version` is still set by hand.
- `android.buildType: "apk"` gives an installable APK; the Android default is an AAB, the only format Play accepts.
- `eas submit` can make the app's first release on the internal testing track; the release stays a draft until the store listing is complete.
- The splash screen and icon don't show in Expo Go; they must be checked on a preview build.
- `android.blockedPermissions` removes permissions that libraries merge into the manifest. `expo-image-picker` adds `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and `RECORD_AUDIO` unless `microphonePermission: false` (already set).

## Goals / Non-Goals

**Goals:**

- One command each for an installable test APK and a Play-ready AAB, both pointed at an HTTPS server.
- Build numbers that can't collide or go backwards, without committing after each build.
- Parcel Flow branding on the home screen, splash and Play listing.
- A written runbook, so a release doesn't depend on this conversation.

**Non-Goals:**

- iOS, EAS Update, Sentry in the app, building in CI, a development-client profile (Expo Go is enough while no custom native code exists).
- Moving beyond Play internal testing (closed or production tracks).

## Decisions

### Two build profiles, no development profile

`preview` (APK, `distribution: "internal"`, `environment: "preview"`) and `production` (AAB, `distribution: "store"`, `environment: "production"`, `autoIncrement: true`). A development client only pays off once the app needs native code Expo Go lacks; it can be added then.

Both profiles share settings through a `base` profile with `extends`, so the Android image and Node/Bun versions are set once. `cli.version` pins a minimum EAS CLI version.

### EAS owns the build number

`appVersionSource: "remote"` instead of a `versionCode` in `app.json`. With a local source, every `autoIncrement` build would have to be committed, and two machines could build the same number. Play rejects a reused `versionCode`, so EAS holding the counter is the safer choice. `version` (`1.0.0`) stays in `app.json` and changes by hand in a normal PR.

The preview profile does not auto-increment: preview APKs never go to Play, so they reuse the current number.

### The API URL comes from EAS environments

`EXPO_PUBLIC_API_URL` is set with `eas env` per environment, as a plain-text variable (it is inlined into the app bundle anyway, so it isn't secret). Nothing is committed to `eas.json`, so pointing a build somewhere else needs no code change.

### Release builds reject `http://`

Android blocks cleartext HTTP in release builds by default (Expo enables it only in debug). An `http://` URL in a release build would make every request fail with a vague network error. `readApiUrl` gains a flag for release builds (`!__DEV__`) that accepts only `https:`, so the app shows its existing configuration error instead. Expo Go and dev keep accepting LAN `http://` addresses.

Alternative considered: allow cleartext with a config plugin. Rejected: sessions and cash amounts travel over this connection.

### Icons rendered from SVG sources by a script

The web mark (`src/app/icon.svg`: an outlined box in `#c9b4fa` on `#1b1938`) is the brand. The app gets SVG sources for each image and a `bun run icons` script that renders them with `sharp` (a mobile dev dependency), so the PNGs can be regenerated rather than hand-exported:

| Output                        | Size      | Content                                                       |
| ----------------------------- | --------- | ------------------------------------------------------------- |
| `icon.png`                    | 1024×1024 | Mark on indigo, full bleed (Android legacy, iOS later)        |
| `android-icon-foreground.png` | 1024×1024 | Mark only, transparent, inside the central 66% safe zone      |
| `android-icon-monochrome.png` | 1024×1024 | Same shape, single colour, for Android 13 themed icons        |
| `splash-icon.png`             | 1024×1024 | Mark only, transparent                                        |
| `store/play-store-icon.png`   | 512×512   | Mark on indigo, for the Play listing (not bundled in the app) |

The adaptive icon uses `backgroundColor: "#1b1938"` instead of a background image, so `android-icon-background.png` is deleted. The splash keeps its indigo background, with `imageWidth` adjusted to the new image. `favicon.png` (Expo web) is removed with the web output it served, since the app doesn't ship for web.

### Version label from `expo-application`

`expo-application` (`nativeApplicationVersion`, `nativeBuildVersion`) reads the installed build's real `versionName` and `versionCode`, which `expo-constants` can't give for a remote build number. It is part of Expo Go. In Expo Go those values are Expo Go's own, so in `__DEV__` the label reads "Development build".

### Permissions trimmed against the real manifest

Run `bunx expo prebuild --platform android --no-install` once (the `android/` folder is gitignored and deleted afterwards), read the merged permission list, and block any the app doesn't use. Expected keepers: `INTERNET`, `CAMERA`. `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` are likely unneeded because the gallery uses the system photo picker on Android 13+, but they stay unless the preview build proves "Choose from gallery" still works on an older Android without them. The final list feeds the Play Data safety answers in the runbook.

Result: prebuild's manifest adds `SYSTEM_ALERT_WINDOW` and `VIBRATE` from the Expo template, which the app never uses, so both are blocked. `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` already carry `maxSdkVersion="32"` (Android 12 and older only), so they stay. `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` come from `expo-network`, which the query client uses for online status.

### A public privacy page on the web app

Play asks for a privacy policy URL. `/privacy` on the existing web app is a static server component outside `/dashboard`, so the proxy already leaves it public. It states what the app collects (account details, parcel and delivery data, proof photos, no location, no ads or analytics) and who to contact. Wording is a plain draft for the user to edit.

## Risks / Trade-offs

- **Steps that need the user's accounts** (Expo login, Play developer account, service account key, store listing) → the runbook lists them in order; the build tasks that need them are marked as the user's.
- **New Play personal accounts need a 12-tester closed test before production** → out of scope here; internal testing has no such rule. Noted in the runbook.
- **Upload key is held by EAS** → EAS generates and stores the Android keystore; Play App Signing holds the app signing key. The runbook says to keep a downloaded copy of the upload keystore (`eas credentials`).
- **`sharp` is a native dev dependency** → it only runs locally for `bun run icons`; CI installs with `--ignore-scripts` and never runs it. Prebuilt binaries mean no compile step.

## Open Questions

- Which server should preview APKs use? Resolved: Railway's `staging` environment (deploys `dev`, already has the mobile API). Production builds use the `production` environment (deploys `main`), so `dev` must be merged into `main` before the first Play build. Both can be changed with `eas env` alone.
- Contact email for the privacy page. Default: a placeholder the user fills in before submitting the listing.
