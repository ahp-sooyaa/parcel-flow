# rider-management Specification

## Purpose
TBD - created by archiving change add-rider-list-and-create. Update Purpose after archive.
## Requirements
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

### Requirement: Rider profiles can be edited from dedicated rider routes
The system SHALL provide a rider profile edit workflow at `/dashboard/riders/[id]/edit`. The workflow MUST load rider operational fields from rider feature DAL functions, MUST validate updates on the server, and MUST keep shared identity fields separate from rider-only fields.

#### Scenario: Admin edits rider profile from dedicated route
- **WHEN** a super admin or office admin with `rider.update` opens `/dashboard/riders/[id]/edit` for an existing rider user
- **THEN** the system SHALL load the rider edit form with the current rider profile values

#### Scenario: Rider user edits owned rider profile
- **WHEN** an authenticated rider opens `/dashboard/riders/[id]/edit` for their own rider record
- **THEN** the system SHALL allow access to the edit workflow and persist valid rider-only updates

#### Scenario: Rider user cannot edit another rider profile
- **WHEN** a rider user opens `/dashboard/riders/[id]/edit` for a rider record they do not own
- **THEN** the system SHALL deny access to that route

### Requirement: Rider detail views expose the edit entry point only when authorized
The system SHALL expose rider profile edit entry points from rider detail and user-management flows only to authorized actors. Unauthorized users MUST NOT receive edit controls or successful mutation paths.

#### Scenario: Admin sees rider edit entry point
- **WHEN** a super admin or office admin can access a rider detail page
- **THEN** the system SHALL display a path to the rider edit workflow

#### Scenario: Rider owner sees self edit entry point
- **WHEN** a rider user can access their own rider detail page
- **THEN** the system SHALL display a path to the rider edit workflow for that same rider record

