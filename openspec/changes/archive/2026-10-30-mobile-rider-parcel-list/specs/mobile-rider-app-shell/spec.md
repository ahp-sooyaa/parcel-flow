## MODIFIED Requirements

### Requirement: Rider profile and sign-out

The mobile app SHALL show the signed-in rider who they are on a Profile screen reachable from the parcel list, and SHALL let them sign out from it.

#### Scenario: Rider sees their profile

- **WHEN** a signed-in rider opens the Profile screen from the parcel list header
- **THEN** the app shows their name, username, and phone number loaded from `GET /api/mobile/v1/me`

#### Scenario: Password reset required

- **WHEN** the loaded profile has `mustResetPassword` set to true
- **THEN** the Profile screen shows a notice to change their password from the web dashboard

#### Scenario: Rider signs out

- **WHEN** a signed-in rider taps sign out on the Profile screen
- **THEN** the app ends the session on the server, removes it from the device, clears cached rider data, and shows the sign-in screen
