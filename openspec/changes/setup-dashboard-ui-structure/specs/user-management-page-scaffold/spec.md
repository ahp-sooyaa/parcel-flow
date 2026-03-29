## ADDED Requirements

### Requirement: User Create Page Availability
The system SHALL provide a user creation page under the dashboard route group that is reachable from the users section.

#### Scenario: User opens create page
- **WHEN** an authorized internal user navigates to the user create route
- **THEN** the system renders the user creation page UI

### Requirement: Role and Permission Inputs on User Create
The user creation page SHALL include explicit form inputs for selecting a role and assigning permissions.

#### Scenario: User reviews form fields
- **WHEN** the create-user page is displayed
- **THEN** the form includes both a role field and a permission field

### Requirement: Placeholder Pages for Non-Implemented Sections
Dashboard section pages other than sign-in and user create SHALL render a placeholder text `coming soon...` until full feature implementation is delivered.

#### Scenario: User opens unimplemented section page
- **WHEN** the user navigates to a dashboard section that is not yet implemented
- **THEN** the page content displays `coming soon...`
