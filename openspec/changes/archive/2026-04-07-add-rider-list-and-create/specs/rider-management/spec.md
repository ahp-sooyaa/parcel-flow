## ADDED Requirements

### Requirement: Authorized staff can list riders
The system SHALL provide a rider list view for users with `rider-list.view` permission. The list SHALL support optional search and SHALL return rider records ordered for operational lookup, including key profile fields and linked user display data.

#### Scenario: Rider list is accessible with permission
- **WHEN** an authenticated user with `rider-list.view` opens `/dashboard/riders`
- **THEN** the system displays the rider list page with rider rows and search input

#### Scenario: Rider list is denied without permission
- **WHEN** an authenticated user without `rider-list.view` requests `/dashboard/riders`
- **THEN** the system denies access using the existing authorization flow

#### Scenario: Rider list supports search
- **WHEN** a permitted user submits a search query on rider list
- **THEN** the system filters riders by supported searchable fields and returns matching rows only

### Requirement: Authorized staff can create rider profiles
The system SHALL allow users with `rider.create` permission to create rider profiles through a server action with zod-validated input. The server SHALL only persist explicit allowlisted fields and SHALL never trust client-provided authorization or ownership data.

#### Scenario: Rider profile created successfully
- **WHEN** a permitted user submits valid rider create form data
- **THEN** the server creates a rider record and returns a success response

#### Scenario: Invalid rider create payload is rejected
- **WHEN** a permitted user submits invalid or incomplete rider create form data
- **THEN** the server returns a validation error response and no rider record is created

#### Scenario: Rider create denied without permission
- **WHEN** a user without `rider.create` attempts rider creation
- **THEN** the system denies the mutation and persists no rider record

### Requirement: Rider-to-app-user linking is unique and verified
If rider creation includes a linked app user, the system MUST verify the linked user exists, role is rider role and MUST prevent linking a single app user to multiple rider profiles.

#### Scenario: Linked app user not found
- **WHEN** rider create is submitted with a linked app user ID that does not exist
- **THEN** the server returns an error and no rider record is created

#### Scenario: Linked app user already linked to another rider
- **WHEN** rider create is submitted with an app user ID already linked to an existing rider
- **THEN** the server returns an error and no duplicate link is created

### Requirement: Rider creation remains auditable and immediately visible
Successful rider creation SHALL log an audit event and SHALL revalidate the rider list route so new records are visible without manual cache clearing.

#### Scenario: Audit event is recorded
- **WHEN** a rider record is created successfully
- **THEN** the system records an audit log entry including actor and rider-create context

#### Scenario: Rider list reflects newly created rider
- **WHEN** rider creation succeeds
- **THEN** the riders list route is revalidated and the new rider appears on subsequent list loads

### Requirement: Township input remains static for current phase
Rider create SHALL use the current static township options in this phase and SHALL NOT require township database tables.

#### Scenario: Rider create renders static township choices
- **WHEN** a permitted user opens rider create page
- **THEN** the township input is populated from static options defined in application constants

#### Scenario: Rider creation succeeds without township master-table dependency
- **WHEN** infrastructure lacks township CRUD/tables for this feature
- **THEN** rider list/create still functions using static township values
