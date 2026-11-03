# mobile-android-release Specification

## Purpose

TBD - created by archiving change android-release-build. Update Purpose after archive.

## Requirements

### Requirement: EAS build profiles

The mobile app SHALL define EAS Build profiles that produce a signed, installable APK for testing and a signed Android App Bundle for Google Play.

#### Scenario: Preview build

- **WHEN** a developer runs `eas build --platform android --profile preview`
- **THEN** EAS produces a signed APK with internal distribution that installs directly on a phone, built with the `preview` EAS environment

#### Scenario: Production build

- **WHEN** a developer runs `eas build --platform android --profile production`
- **THEN** EAS produces a signed Android App Bundle built with the `production` EAS environment

#### Scenario: Local env file is not used

- **WHEN** an EAS build runs
- **THEN** `EXPO_PUBLIC_API_URL` comes from the profile's EAS environment, not from the gitignored `mobile/.env`

### Requirement: Build numbering

The mobile app SHALL keep the user-facing version in `app.json` and let EAS own the Android build number.

#### Scenario: Production build number increments

- **WHEN** a production build starts
- **THEN** EAS increments the stored `versionCode`, so it is higher than every earlier production build, without a commit to the repository

#### Scenario: User-facing version

- **WHEN** any build is made
- **THEN** its `versionName` is the `version` value in `mobile/app.json`

### Requirement: Play internal testing submission

The mobile app SHALL define a submit profile that uploads production builds to the Google Play internal testing track.

#### Scenario: Submit a production build

- **WHEN** a developer runs `eas submit --platform android --profile production` for a production build
- **THEN** the build is uploaded to the internal testing track as a draft release

### Requirement: Parcel Flow branding

The installed app SHALL use the Parcel Flow mark for its launcher icon and splash screen, generated from versioned SVG sources.

#### Scenario: Launcher icon

- **WHEN** the app is installed on Android
- **THEN** the launcher shows the Parcel Flow box mark on the brand indigo as an adaptive icon, and a single-colour version when the device uses themed icons

#### Scenario: Splash screen

- **WHEN** the installed app starts
- **THEN** the splash screen shows the Parcel Flow mark on the brand indigo

#### Scenario: Regenerate icons

- **WHEN** a developer runs `bun run icons` in `mobile/`
- **THEN** every icon, splash and Play Store PNG is rendered again from the SVG sources in `mobile/assets/source/`

### Requirement: Minimal Android permissions

The release build SHALL request only the Android permissions the app uses.

#### Scenario: Unused permissions removed

- **WHEN** the release manifest is generated
- **THEN** it does not request the microphone or any other permission that a library adds but the app never uses

### Requirement: Public privacy policy

The web app SHALL serve a privacy policy page that anyone can open without signing in, for the Google Play listing.

#### Scenario: Open the privacy page

- **WHEN** anyone opens `/privacy`
- **THEN** the page describes what the rider app and web app collect, why, and who to contact, without requiring a session
