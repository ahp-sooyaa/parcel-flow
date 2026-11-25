## Why

Riders can only run the app through Expo Go on the same Wi-Fi as a development machine. To use it on the road it has to be a real installed Android app, signed, pointed at the deployed server, and handed out through Google Play. The app also still shows the Expo template icon and splash. See `docs/mobile-app.md`; this is slice 9 of 9, the last one.

## What Changes

- **EAS Build profiles** in a new `mobile/eas.json`:
  - `preview`: a signed APK with internal distribution, for installing straight onto a phone from an EAS link.
  - `production`: a signed AAB for Google Play, with the build number (`versionCode`) kept and bumped by EAS (`appVersionSource: "remote"`, `autoIncrement`).
  - Each profile reads `EXPO_PUBLIC_API_URL` from its EAS environment (`preview`, `production`), never from the gitignored `mobile/.env`.
  - A `production` submit profile that uploads to the Play **internal testing** track as a draft.
- **Versioning**: `version` in `app.json` stays the user-facing version (`1.0.0`), changed by hand per release; EAS owns `versionCode`.
- **Brand icon and splash**: replace the Expo template images with the Parcel Flow box mark from `src/app/icon.svg`.
  - SVG sources in `mobile/assets/source/`, rendered to PNG by `bun run icons` (`mobile/scripts/render-icons.ts`, `sharp`).
  - App icon, Android adaptive icon (foreground inside the safe zone on the brand indigo, monochrome for themed icons), splash image, and a 512×512 Play Store icon.
  - Drop the template `assets/expo.icon` folder; iOS points at the same `icon.png` until the iOS release.
- **Release-safe API URL**: release builds accept only an `https://` API URL. Android blocks plain HTTP in release builds, so an `http://` value would fail on every request; the app shows the configuration error instead.
- **Version on the Profile screen**: "Version 1.0.0 (build 7)" so testers can say which build they're on.
- **Android permissions**: keep only what the app uses (camera, picking a photo, network). Block what libraries add that the app never uses, checked against the manifest from `expo prebuild`.
- **Privacy policy page**: a public `/privacy` page on the web app. Google Play needs a privacy policy URL for an app that uses the camera and handles personal data.
- **Release runbook**: `docs/mobile-release.md` with the one-time setup (Expo account, `eas init`, EAS environment variables, Play Console app, service account key), and the steps for each release.
- **Docs**: `docs/mobile-app.md` roadmap status.

Not included: iOS builds, EAS Update (over-the-air updates), crash reporting in the app, and CI that builds the app (builds run from a developer's machine with `eas build`).

## Capabilities

### New Capabilities

- `mobile-android-release`: how the rider app is built, versioned, branded and released to Google Play internal testing, and the privacy policy page Play requires.

### Modified Capabilities

- `mobile-rider-app-shell`: release builds require an `https://` API URL; the Profile screen shows the app version and build number.

## Impact

- New: `mobile/eas.json`, `mobile/assets/source/*.svg`, `mobile/store/play-store-icon.png`, `mobile/scripts/render-icons.ts`, `docs/mobile-release.md`, `src/app/privacy/page.tsx`.
- Changed: `mobile/app.json` (icons, splash, blocked permissions, later `extra.eas.projectId` from `eas init`), `mobile/assets/images/*.png`, `mobile/src/config.ts`, the Profile screen, `mobile/package.json` (`icons` script, `sharp` and `expo-application`).
- No server API or contract changes. `parcelflow://`, the origin release builds send, is already trusted by Better Auth.
- Needs the user's own accounts for steps I can't do: an Expo account (`eas login`), the Google Play developer account and app, and the service account key.
