## ADDED Requirements

### Requirement: Internal Sign-In Page Availability
The system SHALL provide an internal sign-in page at the auth route group path `/(auth)/sign-in` with a structured form-focused UI.

#### Scenario: User navigates to sign-in route
- **WHEN** an unauthenticated user opens the sign-in page route
- **THEN** the system renders a sign-in page with recognizable app context and credential entry controls

### Requirement: Sign-In Page Field Structure
The sign-in page SHALL include explicit input controls for identity and secret credentials and a submit action control.

#### Scenario: Sign-in form visibility
- **WHEN** the sign-in page is rendered
- **THEN** the user can view and interact with identity, password, and submit controls

### Requirement: Sign-In Page Separation from Dashboard Shell
The sign-in page SHALL NOT render the dashboard sidebar shell used by authenticated internal sections.

#### Scenario: Sign-in layout isolation
- **WHEN** a user opens the sign-in page
- **THEN** dashboard sidebar navigation is not displayed on the page
