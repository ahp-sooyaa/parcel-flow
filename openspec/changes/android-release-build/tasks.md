## 1. Build configuration

- [x] 1.1 Add `mobile/eas.json`: `cli` (`version`, `appVersionSource: "remote"`), a `base` profile, `preview` (APK, `distribution: "internal"`, `environment: "preview"`) and `production` (AAB, `distribution: "store"`, `environment: "production"`, `autoIncrement: true`) extending it, and `submit.production.android` (`track: "internal"`, `releaseStatus: "draft"`).
- [x] 1.2 Run `bunx expo prebuild --platform android --no-install`, list the merged permissions, add `android.blockedPermissions` for the unused ones, then delete the generated `android/` folder.
- [x] 1.3 Run `bunx expo-doctor` and `bunx expo config --type public` and fix anything they report.

## 2. Icons and splash

- [x] 2.1 Add SVG sources in `mobile/assets/source/` (icon, adaptive foreground in the safe zone, monochrome, splash, Play Store icon) from the mark in `src/app/icon.svg`.
- [x] 2.2 Add `sharp` as a mobile dev dependency and `mobile/scripts/render-icons.ts` with a `bun run icons` script; render the PNGs.
- [x] 2.3 Point `app.json` at the new images: adaptive icon with `backgroundColor` and no background image, splash `imageWidth`, iOS `icon` at `icon.png`. Delete `assets/expo.icon`, `android-icon-background.png` and `favicon.png`.

## 3. App changes

- [x] 3.1 `readApiUrl(value, { allowHttp })` in `mobile/src/config.ts`: `apiUrl` passes `allowHttp: __DEV__`. Unit tests for https in release, http in development, and http rejected in release.
- [x] 3.2 Add `expo-application` with `bunx expo install`, an `appVersionLabel()` helper, and the version line on the Profile screen. Tests for the release label and the development label.

## 4. Web privacy page

- [x] 4.1 Add `src/app/privacy/page.tsx`: a static page on what is collected (account, parcels, delivery proof photos, failure notes, cash amounts), why, retention, no ads or tracking, and a contact placeholder. Check it loads signed out.

## 5. Docs

- [x] 5.1 Write `docs/mobile-release.md`: one-time setup (`eas login`, `eas init`, `EXPO_PUBLIC_API_URL` for `preview` and `production` with `eas env` (check the subcommand with `bunx eas-cli env --help`), Play Console app, store listing, privacy URL, Data safety answers, service account key, testers list), each release (bump `version`, `eas build`, `eas submit`, tester opt-in link), keystore backup, and the 12-tester rule before production.
- [x] 5.2 Update `docs/mobile-app.md`: slice 9 status, and point the Builds row at the runbook.

## 6. Checks

- [x] 6.1 Mobile lint, format check, typecheck and tests; web lint, typecheck and unit tests.
- [x] 6.2 (User, with their Expo account) `eas init`, set `EXPO_PUBLIC_API_URL` for both environments, then build a preview APK.
- [x] 6.3 (User) Install the APK: icon, themed icon, splash, sign in against the deployed server, live updates, camera proof photo, gallery pick, version label.
- [ ] 6.4 (User, with their Play account) Production build and `eas submit` to internal testing; install from the Play testing link.
