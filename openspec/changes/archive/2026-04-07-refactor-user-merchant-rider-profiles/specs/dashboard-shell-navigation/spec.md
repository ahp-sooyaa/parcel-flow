## MODIFIED Requirements

### Requirement: Sidebar Menu Coverage
The dashboard sidebar SHALL include menu links for `dashboard`, `users`, `merchants`, `riders`, `parcels`, `townships`, and `unauthorized` sections.

#### Scenario: User views sidebar navigation
- **WHEN** the dashboard shell is rendered
- **THEN** the user can see menu entries for all required sections including townships

## ADDED Requirements

### Requirement: Township sidebar visibility remains ungated in this round
The dashboard shell SHALL render the township sidebar entry without adding an authorization-based visibility check in this refactor.

#### Scenario: Authenticated dashboard user sees township link
- **WHEN** an authenticated user views the dashboard shell
- **THEN** the township navigation entry is visible even though dedicated township authorization logic is deferred
