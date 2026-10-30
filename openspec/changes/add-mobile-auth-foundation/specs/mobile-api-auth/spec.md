## ADDED Requirements

### Requirement: Mobile client sign-in

The system SHALL let the Parcel Flow mobile app sign in with username and password through Better Auth, and SHALL accept the resulting session on later mobile API requests.

#### Scenario: Rider signs in from the mobile app

- **WHEN** an active rider submits a valid username and password from the mobile app with a trusted app origin
- **THEN** the system creates a session and returns credentials the mobile client can store and send on later requests

#### Scenario: Untrusted origin is refused

- **WHEN** an auth request that carries a session cookie arrives with an app origin that is not in the configured trusted origins
- **THEN** the system refuses the request with HTTP 403 and does not set a session cookie

#### Scenario: Inactive account is refused

- **WHEN** an inactive user signs in from the mobile app
- **THEN** the system refuses to create a session and returns the inactive-account message

#### Scenario: Web sign-in is unchanged

- **WHEN** a user signs in from the web login form
- **THEN** sign-in, session cookies, and role landing redirects behave as before

### Requirement: Rider-scoped mobile API access

The system SHALL serve the mobile API under `/api/mobile/v1` and SHALL allow only active riders to use rider endpoints.

#### Scenario: Missing session

- **WHEN** a request to a mobile rider endpoint has no valid session
- **THEN** the system responds with HTTP 401 and `{ ok: false, message }`

#### Scenario: Non-rider role

- **WHEN** a signed-in super admin, office admin, or merchant calls a mobile rider endpoint
- **THEN** the system responds with HTTP 403 and `{ ok: false, message }`

#### Scenario: Inactive rider

- **WHEN** a rider whose account was deactivated after sign-in calls a mobile rider endpoint
- **THEN** the system responds with HTTP 403 and does not return rider data

### Requirement: Mobile current user endpoint

The system SHALL provide `GET /api/mobile/v1/me`, which returns the signed-in rider's mobile profile.

#### Scenario: Rider loads own profile

- **WHEN** an active, signed-in rider calls `GET /api/mobile/v1/me`
- **THEN** the system responds with HTTP 200 and `{ ok: true, message, data }`, where `data` contains the rider's id, name, username, phone number, role, and password reset requirement

#### Scenario: Internal fields are not exposed

- **WHEN** the mobile current user endpoint returns a profile
- **THEN** the response does not include the internal email, address, or session token values

### Requirement: Shared mobile API contract

The system SHALL define mobile API request and response shapes in a contract module that has no server-only dependencies.

#### Scenario: Contract is portable

- **WHEN** the mobile contract module is imported outside the Next.js server
- **THEN** it depends only on validation schemas and types, and does not import database, Next.js, or server-only modules

#### Scenario: Consistent response envelope

- **WHEN** any `/api/mobile/v1` endpoint responds
- **THEN** the body matches the shared envelope: `{ ok: true, message, data? }` on success or `{ ok: false, message }` on failure
