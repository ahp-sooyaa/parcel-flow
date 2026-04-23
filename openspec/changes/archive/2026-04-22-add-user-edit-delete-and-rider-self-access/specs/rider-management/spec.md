## ADDED Requirements

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
