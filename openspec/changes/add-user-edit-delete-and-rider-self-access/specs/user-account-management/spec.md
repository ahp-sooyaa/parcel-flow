## ADDED Requirements

### Requirement: Admins can edit shared user account fields from user management
The system SHALL let authorized administrative users edit shared app user profile fields from dashboard user-management entry points. The edit workflow MUST validate input on the server, MUST allowlist editable fields explicitly, and MUST update only shared identity fields stored on `app_users`.

#### Scenario: Admin opens user edit workflow from users list
- **WHEN** a super admin or office admin with `user.update` opens the edit action for a listed user
- **THEN** the system SHALL load a user-management edit workflow for that target user instead of requiring direct database edits

#### Scenario: Shared user fields are updated successfully
- **WHEN** an authorized admin submits valid shared profile data for a target user
- **THEN** the system SHALL persist the allowed `app_users` fields, record an audit event, and refresh affected user-management pages

#### Scenario: Invalid shared user data is rejected
- **WHEN** an authorized admin submits invalid or unsupported shared profile fields
- **THEN** the system SHALL reject the mutation without changing stored user data

### Requirement: Admin workflows include linked merchant or rider profile maintenance
The system SHALL allow administrative user-management workflows to route authorized staff into the linked merchant or rider profile edit experience for merchant and rider users. The system MUST keep role-specific business logic in the merchant and rider feature slices instead of updating role-profile tables through generic client forms.

#### Scenario: Merchant user edit exposes merchant profile maintenance
- **WHEN** an authorized admin manages a user whose role is `merchant`
- **THEN** the system SHALL provide an entry point to edit that user’s linked merchant profile fields through the merchant edit workflow

#### Scenario: Rider user edit exposes rider profile maintenance
- **WHEN** an authorized admin manages a user whose role is `rider`
- **THEN** the system SHALL provide an entry point to edit that user’s linked rider profile fields through the rider edit workflow

### Requirement: Soft-delete workflow is guarded and auditable
The system SHALL provide a super-admin-only soft-delete workflow for app users that immediately removes dashboard access for the deleted account by setting `deleted_at` on the target app user and the linked 1:1 merchant or rider profile record when present. The workflow MUST execute on the server, MUST require explicit confirmation, MUST record an audit event, and MUST fail closed when guard conditions are not satisfied.

#### Scenario: Super admin soft-deletes an eligible user safely
- **WHEN** a super admin confirms deletion for an eligible target user
- **THEN** the system SHALL set `deleted_at` for the target user and linked role profile records, remove the target user from normal operational UI, and refresh affected list and detail pages

#### Scenario: User cannot delete own account
- **WHEN** an authenticated admin attempts to delete their own current user account
- **THEN** the system SHALL reject the delete request and keep the account unchanged

#### Scenario: Last active super admin is protected
- **WHEN** a delete request targets the last active super-admin account
- **THEN** the system SHALL reject the request and explain that at least one active super admin must remain

#### Scenario: Soft-deleted records are excluded from normal user management results
- **WHEN** a user, merchant, or rider record has `deleted_at` set
- **THEN** normal list, detail, and navigation queries SHALL exclude that record from operational UI by default
