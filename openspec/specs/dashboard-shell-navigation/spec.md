# dashboard-shell-navigation Specification

## Purpose
TBD - created by archiving change setup-dashboard-ui-structure. Update Purpose after archive.
## Requirements
### Requirement: Dashboard Shell for Internal Routes
The system SHALL provide a shared dashboard layout shell for routes inside `/(dashboard)` that includes app identity, signed-in user context area, and sidebar navigation.

#### Scenario: Dashboard page uses shared shell
- **WHEN** a user opens any route within the dashboard route group
- **THEN** the page is rendered within the shared dashboard layout shell

### Requirement: Sidebar Menu Coverage
The dashboard sidebar SHALL include menu links for `dashboard`, `users`, `merchants`, `riders`, `parcels`, `townships`, and `unauthorized` sections.

#### Scenario: User views sidebar navigation
- **WHEN** the dashboard shell is rendered
- **THEN** the user can see menu entries for all required sections including townships

### Requirement: Sidebar Navigation Behavior
Sidebar menu entries SHALL route users to their corresponding section pages without requiring direct URL entry.

#### Scenario: User selects a menu link
- **WHEN** the user clicks a sidebar menu entry
- **THEN** the system navigates to the matching dashboard section route

### Requirement: Township sidebar visibility remains ungated in this round
The dashboard shell SHALL render the township sidebar entry without adding an authorization-based visibility check in this refactor.

#### Scenario: Authenticated dashboard user sees township link
- **WHEN** an authenticated user views the dashboard shell
- **THEN** the township navigation entry is visible even though dedicated township authorization logic is deferred

### Requirement: Dashboard shell provides self-navigation for merchant and rider users
The system SHALL build dashboard sidebar navigation on the server and SHALL expose self-navigation links for merchant and rider users when the current session resolves an owned merchant or rider profile. Admin list navigation MUST remain permission-driven.

#### Scenario: Merchant user sees self merchant navigation
- **WHEN** the current user has role `merchant` and the server resolves the owned merchant profile identifier
- **THEN** the dashboard shell SHALL show a self-navigation item to that merchant detail route instead of the admin merchant list link

#### Scenario: Rider user sees self rider navigation
- **WHEN** the current user has role `rider` and the server resolves the owned rider profile identifier
- **THEN** the dashboard shell SHALL show a self-navigation item to that rider detail route instead of requiring the rider user to navigate only through parcels

#### Scenario: Admin navigation remains permission-driven
- **WHEN** the current user has list permissions for merchants or riders
- **THEN** the dashboard shell SHALL show the corresponding list navigation items regardless of self-service link behavior for merchant or rider users

