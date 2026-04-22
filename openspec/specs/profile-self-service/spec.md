# profile-self-service Specification

## Purpose
TBD - created by archiving change add-user-edit-delete-and-rider-self-access. Update Purpose after archive.
## Requirements
### Requirement: Users can update their own shared account fields from the settings page
The system SHALL keep `/dashboard/settings` as the self-service page for shared identity data. The settings workflow MUST allow the authenticated user to update only their own allowed shared fields, MUST validate input on the server, and MUST NOT trust any client-supplied ownership value.

#### Scenario: User updates own shared account data
- **WHEN** an authenticated user submits valid self-account data on `/dashboard/settings`
- **THEN** the system SHALL update that user’s own shared account record and refresh the settings page

#### Scenario: Settings page rejects invalid self-account data
- **WHEN** an authenticated user submits invalid self-account input
- **THEN** the system SHALL reject the mutation without changing stored account data

### Requirement: Settings page exposes role-aware profile maintenance
The system SHALL present role-aware settings from `/dashboard/settings` when a user has additional merchant or rider profile data. Merchant users MUST be able to manage their merchant profile from the settings area, and rider users MUST be able to manage their rider profile from the settings area.

#### Scenario: Merchant settings page exposes merchant profile maintenance
- **WHEN** the authenticated user has the `merchant` role and an owned merchant profile
- **THEN** `/dashboard/settings` SHALL display a merchant profile maintenance surface

#### Scenario: Rider settings page exposes rider profile maintenance
- **WHEN** the authenticated user has the `rider` role and an owned rider profile
- **THEN** `/dashboard/settings` SHALL display a rider profile maintenance surface

