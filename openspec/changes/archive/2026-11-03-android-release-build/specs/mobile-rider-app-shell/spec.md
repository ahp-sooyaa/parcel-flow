## MODIFIED Requirements

### Requirement: Rider profile and sign-out

The mobile app SHALL show the signed-in rider who they are on a Profile screen reachable from the parcel list, SHALL show which app build is installed, and SHALL let them sign out from it.

#### Scenario: Rider sees their profile

- **WHEN** a signed-in rider opens the Profile screen from the parcel list header
- **THEN** the app shows their name, username, and phone number loaded from `GET /api/mobile/v1/me`

#### Scenario: Password reset required

- **WHEN** the loaded profile has `mustResetPassword` set to true
- **THEN** the Profile screen shows a notice to change their password from the web dashboard

#### Scenario: Rider sees the app version

- **WHEN** a rider opens the Profile screen in an installed build
- **THEN** it shows the app version and build number, for example "Version 1.0.0 (build 7)"

#### Scenario: App version in development

- **WHEN** the app runs in development (Expo Go)
- **THEN** the Profile screen shows "Development build" instead of Expo Go's own version

#### Scenario: Rider signs out

- **WHEN** a signed-in rider taps sign out on the Profile screen
- **THEN** the app ends the session on the server, removes it from the device, clears cached rider data, and shows the sign-in screen

### Requirement: Mobile app configuration

The mobile app SHALL read its API base URL from configuration rather than code, and release builds SHALL accept only an HTTPS API URL.

#### Scenario: API URL configured

- **WHEN** the app is built or started with `EXPO_PUBLIC_API_URL` set
- **THEN** all auth and mobile API requests go to that base URL

#### Scenario: API URL missing

- **WHEN** the app starts without `EXPO_PUBLIC_API_URL`
- **THEN** it shows a configuration error instead of making requests to a guessed address

#### Scenario: HTTP URL in a release build

- **WHEN** a release build starts with an `http://` API URL
- **THEN** it shows the configuration error instead of making requests Android would block

#### Scenario: HTTP URL in development

- **WHEN** the app runs in development with an `http://` LAN address
- **THEN** it uses that address, as before
