# Parcel Flow — Rider App Release (Android)

How to build the rider app and ship it to Google Play internal testing. The app's architecture and roadmap are in `docs/mobile-app.md`.

Run every command from `mobile/`. EAS CLI runs through `bunx eas-cli` (no global install).

---

## 1. How builds are set up

| Profile      | Output | Distribution             | EAS environment | Build number            |
| ------------ | ------ | ------------------------ | --------------- | ----------------------- |
| `preview`    | APK    | Internal link, sideload  | `preview` (staging server) | Current number, no bump |
| `production` | AAB    | Google Play              | `production` (production server) | EAS bumps it each build |

- **Profiles** live in `mobile/eas.json`.
- **Server address:** `EXPO_PUBLIC_API_URL` comes from the profile's EAS environment. `mobile/.env` is gitignored, so it is never uploaded and never used by an EAS build.
- **HTTPS only:** release builds accept only an `https://` address. Android blocks plain HTTP in release builds, so an `http://` value shows the "App not configured" screen.
- **Versions:**
  - `version` in `mobile/app.json` is the version riders see (`versionName`). Change it by hand, in a PR, before each Play release.
  - EAS stores the build number (`versionCode`, `cli.appVersionSource: "remote"`), so builds never need a commit. `bunx eas-cli build:version:get -p android` shows it.
- **Signing:** EAS generates and keeps the upload keystore. Google Play App Signing holds the real app signing key.
- **Sign-in origin:** release builds send `parcelflow://` as their origin, which the server already trusts. No `MOBILE_TRUSTED_ORIGINS` change is needed.

---

## 2. One-time setup

### Expo

1. Create an Expo account at expo.dev, then `bunx eas-cli login`.
2. `bunx eas-cli init` links the project. It adds `extra.eas.projectId` and `owner` to `mobile/app.json`; commit that change. (Done: `@aunghtet99/parcel-flow`.)
3. Set the server address for both environments:

   ```bash
   bunx eas-cli env:set --name EXPO_PUBLIC_API_URL --value https://parcel-flow-staging.up.railway.app --environment preview --visibility plaintext
   ```

   ```bash
   bunx eas-cli env:set --name EXPO_PUBLIC_API_URL --value https://parcel-flow-production.up.railway.app --environment production --visibility plaintext
   ```

   Preview builds use Railway's `staging` environment, which deploys `dev`; production builds use `production`, which deploys `main`. Merge `dev` into `main` before a production build, or the app calls API routes production doesn't have yet. Sign in to a preview build with a rider account from the staging database.

   The value is inlined into the app, so it isn't secret. Check with `bunx eas-cli env:list --environment production`.

4. After the first build, download a backup of the upload keystore: `bunx eas-cli credentials -p android`, then **Download credentials**. Keep it outside the repository (`*.jks` is gitignored).

### Google Play Console

1. A Google Play developer account (one-time fee, identity verification).
2. **Create app**: name "Parcel Flow", app, free.
3. **App content**:
   - Privacy policy: `https://<web app domain>/privacy`. Set the contact email in `src/app/privacy/page.tsx` first.
   - App access: sign-in is required. Give reviewers a rider test account.
   - Ads: none.
   - Data safety, from what the app does:
     - Personal info: name, phone number (account; collected, not shared, required).
     - Photos: delivery proof photos (collected, not shared, required for marking delivered).
     - The app sends no crash reports, location, contacts, audio, or advertising ID.
     - Data is encrypted in transit.
   - Target audience: 18 and over. Content rating questionnaire.
4. **Store listing**: short and full description, the 512×512 icon (`mobile/store/play-store-icon.png`), a 1024×500 feature graphic, and at least two phone screenshots.
5. **Service account for `eas submit`**: follow Expo's guide (expo.dev docs, "Creating a Google Service Account"), then upload the JSON key with `bunx eas-cli credentials -p android` → production → **Google Service Account**. Don't commit the key.
6. **Testing → Internal testing → Testers**: create an email list of riders and admins (up to 100).

---

## 3. Test a build on a phone (preview APK)

```bash
bunx eas-cli build --platform android --profile preview
```

Open the link EAS prints on the phone (or scan its QR code) and install the APK. Allow installing from that source when Android asks. Check:

- The launcher icon and the themed (monochrome) icon.
- The splash screen (Expo Go doesn't show it).
- Sign in, the parcel list, live updates, a camera proof photo, choosing a gallery photo, and the version line on Profile.

---

## 4. Release to internal testing

1. Bump `version` in `mobile/app.json` if riders should see a new version (merge it to `dev` first).
2. Build:

   ```bash
   bunx eas-cli build --platform android --profile production
   ```

3. Submit the finished build:

   ```bash
   bunx eas-cli submit --platform android --profile production --latest
   ```

   It goes to **Internal testing** as a draft release. The first one stays a draft until the store listing and app content are complete.

4. In Play Console, open the draft release, add release notes, and roll it out to internal testing.
5. Testers join through the opt-in link on the Internal testing page, then install from Google Play.

---

## 5. Later: closed and production tracks

- Personal developer accounts created after November 2023 must run a closed test with at least 12 testers for 14 days before they can publish to production.
- To use another track, change `submit.production.android.track` in `mobile/eas.json` (`alpha` is closed testing) or add a second submit profile.

---

## 6. Icons

The icon, adaptive icon, monochrome icon, splash and Play Store icon are rendered from the SVGs in `mobile/assets/source/` (the same box mark as `src/app/icon.svg`). After editing a source:

```bash
bun run icons
```

The adaptive icon's background is `android.adaptiveIcon.backgroundColor` in `app.json`. Keep the foreground mark inside the central 66% of the canvas so launcher masks don't clip it.
