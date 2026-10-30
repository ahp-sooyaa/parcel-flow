## ADDED Requirements

### Requirement: Rider sign-in in the mobile app

The mobile app SHALL let a rider sign in with their Parcel Flow username and password, and SHALL only keep the session when the account is an active rider.

#### Scenario: Rider signs in

- **WHEN** an active rider enters a valid username and password and submits the sign-in form
- **THEN** the app stores the session securely on the device and shows the rider home screen

#### Scenario: Wrong credentials

- **WHEN** a user submits an incorrect username or password
- **THEN** the app stays on the sign-in screen, keeps the entered username, clears the password, and shows "Incorrect username or password."

#### Scenario: Inactive account

- **WHEN** an inactive user submits valid credentials
- **THEN** the app stays on the sign-in screen and shows the server's inactive-account message

#### Scenario: Non-rider account

- **WHEN** a merchant, office admin, or super admin signs in successfully
- **THEN** the app clears the new session and shows a message that the app is only for riders

#### Scenario: Server unreachable

- **WHEN** the sign-in request fails because the server can't be reached
- **THEN** the app shows a connection error and does not store a session

### Requirement: Persistent mobile session and auth gate

The mobile app SHALL keep a rider signed in across app restarts and SHALL only show rider screens to a signed-in rider.

#### Scenario: App restart while signed in

- **WHEN** a signed-in rider closes and reopens the app
- **THEN** the app opens on the rider home screen without asking them to sign in again

#### Scenario: Signed-out user opens a rider screen

- **WHEN** a user with no stored session opens the app
- **THEN** the app shows the sign-in screen and no rider data

#### Scenario: No sign-in flash while loading

- **WHEN** the app is loading the stored session at startup
- **THEN** it shows a loading state, not the sign-in screen, until it knows whether a session exists

#### Scenario: Session rejected by the server

- **WHEN** any mobile API request returns HTTP 401
- **THEN** the app removes the stored session and returns to the sign-in screen

### Requirement: Rider profile and sign-out

The mobile app SHALL show the signed-in rider who they are, and SHALL let them sign out.

#### Scenario: Rider sees their profile

- **WHEN** a signed-in rider opens the home screen
- **THEN** the app shows their name, username, and phone number loaded from `GET /api/mobile/v1/me`

#### Scenario: Password reset required

- **WHEN** the loaded profile has `mustResetPassword` set to true
- **THEN** the home screen shows a notice to change their password from the web dashboard

#### Scenario: Rider signs out

- **WHEN** a signed-in rider taps sign out
- **THEN** the app ends the session on the server, removes it from the device, clears cached rider data, and shows the sign-in screen

### Requirement: Mobile app configuration

The mobile app SHALL read its API base URL from configuration rather than code.

#### Scenario: API URL configured

- **WHEN** the app is built or started with `EXPO_PUBLIC_API_URL` set
- **THEN** all auth and mobile API requests go to that base URL

#### Scenario: API URL missing

- **WHEN** the app starts without `EXPO_PUBLIC_API_URL`
- **THEN** it shows a configuration error instead of making requests to a guessed address
