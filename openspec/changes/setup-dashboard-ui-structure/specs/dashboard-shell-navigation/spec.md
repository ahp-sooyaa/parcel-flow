## ADDED Requirements

### Requirement: Dashboard Shell for Internal Routes
The system SHALL provide a shared dashboard layout shell for routes inside `/(dashboard)` that includes app identity, signed-in user context area, and sidebar navigation.

#### Scenario: Dashboard page uses shared shell
- **WHEN** a user opens any route within the dashboard route group
- **THEN** the page is rendered within the shared dashboard layout shell

### Requirement: Sidebar Menu Coverage
The dashboard sidebar SHALL include menu links for `dashboard`, `users`, `merchants`, `riders`, `parcels`, and `unauthorized` sections.

#### Scenario: User views sidebar navigation
- **WHEN** the dashboard shell is rendered
- **THEN** the user can see menu entries for all required sections

### Requirement: Sidebar Navigation Behavior
Sidebar menu entries SHALL route users to their corresponding section pages without requiring direct URL entry.

#### Scenario: User selects a menu link
- **WHEN** the user clicks a sidebar menu entry
- **THEN** the system navigates to the matching dashboard section route
