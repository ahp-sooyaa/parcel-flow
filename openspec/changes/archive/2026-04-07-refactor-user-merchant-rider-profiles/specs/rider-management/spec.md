## MODIFIED Requirements

### Requirement: Authorized staff can list riders
The system SHALL provide a rider list view for users with rider-list permission. The list SHALL support optional search and SHALL return rider records ordered for operational lookup, joining shared rider identity data from `app_users` and rider-only operational data from `riders`.

#### Scenario: Rider list is accessible with permission
- **WHEN** an authenticated user with rider-list permission opens `/dashboard/riders`
- **THEN** the system displays the rider list page with rider rows and search input

#### Scenario: Rider list supports search across shared and operational identifiers
- **WHEN** a permitted user submits a search query on rider list
- **THEN** the system filters riders by supported shared identity fields and rider operational identifiers and returns matching rows only

### Requirement: Authorized staff can create rider profiles
The system SHALL provide internal rider profile creation through the admin user provisioning workflow, with server-side validation and explicit field allowlisting. Rider profile creation SHALL create a required 1:1 rider profile owned by the created app user rather than a standalone rider record with optional user linkage.

#### Scenario: Staff creates rider user and rider profile with required fields
- **WHEN** an authorized admin submits valid rider-role user creation data
- **THEN** the system creates the app user and rider profile successfully

#### Scenario: Invalid rider profile payload is rejected
- **WHEN** an authorized admin submits invalid rider-role user creation data
- **THEN** the system returns a validation error response and no rider profile is created

#### Scenario: Unexpected rider profile field is not written
- **WHEN** rider-role user creation payload includes a field outside the allowed rider profile contract
- **THEN** the system ignores or rejects the unexpected field and does not persist it

#### Scenario: Rider township uses township table
- **WHEN** rider-role user creation includes township selection
- **THEN** the system stores the rider township reference using a township table record rather than a static string value

### Requirement: Rider-to-app-user linking is unique and verified
Every rider profile MUST belong to exactly one app user, and rider creation or migration MUST prevent multiple rider profiles from pointing at the same app user.

#### Scenario: Rider profile is created with required app user owner
- **WHEN** a rider profile is created from admin provisioning
- **THEN** the system stores the rider profile with the created app user as its required owner

#### Scenario: Duplicate rider ownership is rejected
- **WHEN** a create or migration path attempts to link more than one rider profile to the same app user
- **THEN** the system rejects the duplicate ownership

#### Scenario: Rider cannot exist without linked app user
- **WHEN** a create or migration path attempts to persist a rider profile without an owning app user
- **THEN** the system rejects the write or blocks migration until ownership is resolved

## ADDED Requirements

### Requirement: Rider profile defaults and operational fields remain explicit
The system SHALL keep rider-specific operational fields in the rider profile and SHALL apply only documented defaults during provisioning.

#### Scenario: Vehicle type defaults during rider provisioning
- **WHEN** an authorized admin creates a rider-role user without providing `vehicle_type`
- **THEN** the system stores `vehicle_type = bike` on the rider profile

#### Scenario: Rider shared contact data comes from app users
- **WHEN** rider list or future rider detail data needs shared human identity or contact fields
- **THEN** the system reads those shared fields from `app_users` instead of duplicating them in `riders`

#### Scenario: Rider operational active flag defaults separately
- **WHEN** an authorized admin creates a rider-role user without explicitly providing rider operational active status
- **THEN** the system stores `riders.is_active = true` independently from `app_users.is_active`
