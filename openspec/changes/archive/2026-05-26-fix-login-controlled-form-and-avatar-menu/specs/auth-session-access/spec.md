## ADDED Requirements

### Requirement: Stable login credential form state

The system SHALL keep the login username and password inputs under explicit form-state ownership throughout validation and submission re-renders so the sign-in experience remains stable when authentication fails.

#### Scenario: Username is preserved after failed login

- **WHEN** a user submits the login form with an invalid password or another recoverable authentication error
- **THEN** the login form re-renders with the previously entered username still visible and the validation or authentication message displayed

#### Scenario: Pending submission keeps controlled credentials UI

- **WHEN** a user submits the login form
- **THEN** the form shows its pending state without switching the credential fields between uncontrolled and controlled ownership

### Requirement: Authenticated account avatar menu

The system SHALL present authenticated dashboard account controls through an avatar-triggered menu that displays the signed-in user's identity and logout action.

#### Scenario: Dashboard header shows generated avatar access point

- **WHEN** an authenticated user views any dashboard page
- **THEN** the header displays a deterministic generated avatar for that user as the account-menu trigger instead of relying only on static text identity

#### Scenario: Avatar menu exposes logout

- **WHEN** the authenticated user opens the avatar menu
- **THEN** the menu shows the user's name, role, and a logout action that signs the user out of the current session
